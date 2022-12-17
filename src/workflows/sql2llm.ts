import * as workflows from '../workflows';
import { proxyActivities, sleep } from '@temporalio/workflow';
import * as activities from '../activities';
import { Frame, HumanInTheLoopSession } from '../workflows/session';
import * as sql2llm from '../activities/sql2llm';

const { sql2llm_session_multiplexer, parse_and_fix_csv } = proxyActivities< typeof activities >({ startToCloseTimeout: '10 minute' });

export interface SQL2LLMInput extends Frame {
    dbname: string;
    query: string;
    fields: string[];
    context: string | null;
    result?: SQL2LLMOutput;
}

export interface SQL2LLMOutput extends Frame {
    query: string;
    fields: string[];
    result: any[];
    status: 200 | 500;
    error?: string;
    nSQL_query?: string;
}

class TSession extends HumanInTheLoopSession< SQL2LLMInput > {
    dbname: string;
    fields: string[];

    constructor( dbname: string, fields: string[] ) {
        super();
        this.dbname = dbname;
        this.fields = fields;
    }
}

export async function SQL2LLM_session( dbname: string, fields: string[], context: string | null ): Promise< void >
{
    let session = new TSession( dbname, fields );
    session.init();

    while( true )
    {
        let input = await session.getInput( session );
        session.addMessage( {logs: [], query: input, text: input, ts: new Date(), fields: fields, dbname: dbname, context: context} );
        session.log( "User input [dialog]: " + input );

        let ret = await SQL2LLM_wf( session.messages[session.messages.length-1], session );
        session.messages[session.messages.length-1].response = JSON.stringify(ret.result);
        session.messages[session.messages.length-1].query = ret.query;
        session.send( JSON.stringify(ret) );
    }
}


export async function SQL2LLM_wf( input: SQL2LLMInput, session: TSession ): Promise< SQL2LLMOutput >
{
    let fields = session.fields.map( (f) => { return `"${f}"` } );
    let columns = fields.join( ',' );
    let p = '';

    let context = '';
    if ( input.context )
    {
        context = `==================\nData:\n${input.context}\n==================\n\n`;
    }

    session.messages.reverse();
    let history = session.messages.reverse().map( (m) => {
        return `${context}${session.dbname}> ${m.query}\nESCAPED CSV RESULT\n==========\n${columns}\n`
    });
    session.messages.reverse();

    p += `{{{dbname}}}> .mode CSV
CSV mode on.
{{{history}}}`;

    let objs = {dbname: session.dbname, history: history, context: context};

    let noStopToken = false;
    let result = "";
    while( noStopToken == false )
    {
        let ret = await workflows.promptTemplate( p + result, objs, 48, 1024, 0, "gpt-3", `${session.dbname}>` );
        ret = ret.replace( /^\s+/, '' );
        ret = ret.replace( /\s+$/, '' );

        if ( ret.endsWith('==========') )
        {
            ret = ret.replace( /==========$/, '' );
        }

        if ( ret.length == 0 ) noStopToken = true;
        else {
            console.log( "Trying one more run.")
            result += ret;
        }
    }
    // Take ret and parse it as CSV. Fix it if necessary.
    let parsed = await parse_and_fix_csv( columns + "\n" + result );

    return  {
        query: input.query, 
        fields: input.fields,
        result: parsed,
        status: 200,
        ts: new Date(),
        logs: [],
        text: input.query,
    }

}

export async function SQL2LLM( dbname: string, q: string, context: string | null, natural_language_request: boolean ): Promise< SQL2LLMOutput >
{
    console.log( `Got query for ${dbname}: ${q}`);
    let refined_prompt: string = "";
    if ( natural_language_request )
    {
        refined_prompt = await workflows.promptTemplate(
`Natural language: {{{query}}}
Database: {{{dbname}}}
nSQL Natural language version: `, {query: q, dbname: dbname}, 10, 256, 1, "finetuned-gpt-neox-20b"
        );
        refined_prompt = refined_prompt.replace( /^\s+/, '' ).replace( /\s+$/, '' );
        q = refined_prompt;
    }

    let fieldnames_json = '["' + await workflows.promptTemplate(
`Take the following SQL query: {{{sql}}}

What are the field names in the result set?

JSON list: [ "`, {sql: q}, 5, 128, 0.0, "text-curie-001" );
    let fields = JSON.parse( fieldnames_json );
    let res = await sql2llm_session_multiplexer( {dbname: dbname, fields: fields, query: q, text: q, ts: new Date(), logs: [], context: context} );
    if ( refined_prompt.length > 0 )
        res.nSQL_query = refined_prompt;
    console.log( `${res.result.length} rows returned.\n\n` );
    return( res );
}
