import * as workflows from '../workflows';
import { proxyActivities, sleep } from '@temporalio/workflow';
import * as activities from '../activities';
import { Frame, HumanInTheLoopSession } from '../workflows/session';
import * as sql2llm from '../activities/sql2llm';
import { resourceLimits } from 'node:worker_threads';
import { actionLogger } from '../activities';

const { gpt3_detokenize, gpt3_tokenize, sql2llm_session_multiplexer, parse_and_fix_csv } = proxyActivities< typeof activities >({ startToCloseTimeout: '10 minute' });

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
            if ( result.endsWith('"') && ret.startsWith('"') )
            {
                result += "\n";
            }
            result += ret;
        }
    }
    // Take ret and parse it as CSV. Fix it if necessary.
    let parsed: any[] = await parse_and_fix_csv( columns + "\n" + result );
    // Walk through parsed, and remove the leading and trailing whitespace as well as leading and trailing " columns from all rows
    for( let i = 0; i < parsed.length; i++ )
    {
        for( let j = 0; j < parsed[i].length; j++ )
        {
            parsed[i][j] = parsed[i][j].replace( /^\s+/, '' ).replace( /\s+$/, '' ).replace( /^'/, '' ).replace( /'$/, '' ).replace( /^"/, '' ).replace( /"$/, '' );
        }
    }


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

export async function SQL2LLM( dbname: string | null | undefined, q: string, context: string | null, natural_language_request: boolean ): Promise< SQL2LLMOutput >
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
        q = refined_prompt.replace( /[\r\n]+$/, '' );
    }

    let fieldnames_json = '["' + await workflows.promptTemplate(
`Take the following SQL query: {{{sql}}}

What are the field names in the result set?

JSON list: [ "`, {sql: q}, 5, 128, 0.0, "text-curie-001" );
    let fields = JSON.parse( fieldnames_json );

    // If dbname is null, let's prompt text-curie-001 for it.
    if ( dbname == null )
    {
        dbname = (await workflows.promptTemplate(
`Take the following SQL query: {{{sql}}}
Database:`, {sql: q}, 1, 32, 0.0, "text-curie-001" )).replace( /^\s+/, '' ).replace( /\s+$/, '' );
    }

    if ( context )
    {
        // TODO chunking algo that can optionally overlap chunks so we don't lose context when splitting
        let context_tokens: number[] = await gpt3_tokenize( context );

        console.log(`Tokenized ${context.length} characters into ${context_tokens.length} tokens.`);
        let context_chunks: string[] = [];
        let chunkSize = 2048;
        for ( let i = 0; i < context_tokens.length; i += chunkSize )
        {
            let context_tokens_slice: number[] = context_tokens.slice(i, i + chunkSize);
            let context_slice = await gpt3_detokenize( context_tokens_slice );
            context_chunks.push( context_slice );
        }

        let results: SQL2LLMOutput[] = [];
        if ( context_chunks.length > 1 )
        {
            let promises = context_chunks.map( async (chunk) => {
                let chunk_tokens: number[] = await gpt3_tokenize( chunk );
                console.log( `Context chunk: ${chunk.length} characters, ${chunk_tokens.length} tokens.}`);
                let res = await sql2llm_session_multiplexer( {dbname: dbname!, fields: fields, query: q, text: q, ts: new Date(), logs: [], context: chunk} );
                
                // Add result to the results array.
                res.result.forEach( (r) => { results.push(r) } );
            });
            await Promise.all( promises );

            // Remove duplicates.
            let uniqueResults = Array.from(new Set(results.map( r => JSON.stringify(r) )));
            // Convert back to object.
            uniqueResults = uniqueResults.map( r => JSON.parse(r) );
            console.log( `${results.length} rows returned.\n\n` );
            return( {fields: fields, logs: [], query: q, result: uniqueResults, status: 200, text: q, ts: new Date()} );
        }
        else
        {
            let res = await sql2llm_session_multiplexer( {dbname: dbname, fields: fields, query: q, text: q, ts: new Date(), logs: [], context: context} );
            if ( refined_prompt.length > 0 )
                res.nSQL_query = refined_prompt;
            console.log( `${res.result.length} rows returned.\n\n` );
            return( res );
        }
    }
    else
    {
        let res = await sql2llm_session_multiplexer( {dbname: dbname, fields: fields, query: q, text: q, ts: new Date(), logs: [], context: context} );
        if ( refined_prompt.length > 0 )
            res.nSQL_query = refined_prompt;
        console.log( `${res.result.length} rows returned.\n\n` );
        return( res );
    }
}
