import * as wf from '@temporalio/workflow';
import { proxyActivities, uuid4 } from '@temporalio/workflow';
import * as activities from '../../activities';
import * as session_wfs from '../session';
import * as workflows from '../../workflows';
import * as codegrunt from '../../codegrunt';

const {extractFunctions} = proxyActivities<typeof activities>({startToCloseTimeout: '10 minute' });
// Permanent errors are errors that are not expected to be resolved by retrying the workflow.
// For example, a permanent error could be thrown if the workflow is unable to connect to the
// Temporal server or if the workflow is unable to parse the code.

export async function extractFunctions_wf( code: string, filename: string ): Promise< any[] > {
    let functions = await extractFunctions( code, filename );
    return functions.map( (f: any) => { return {name: f.name, signature: f.signature, leadingComment: f.leadingComment}; } );
}

export async function codegrunt_session( first_message: session_wfs.Frame )
{
    let session = new session_wfs.HumanInTheLoopSession< codegrunt.CodegruntFrame >();
    session.init();

    // Start the session
    session.addMessage( {... first_message} );
    session.log( "Session started" );

    while( true )
    {
        let input = await session.getInput( session );

        session.addMessage({text: input, ts: new Date(), logs: []});
        session.log( "User input: " + input );
        let response = await workflows.promptTemplate(
`User: {{{input}}}
Response:`, { input: input }, 10, 512 );
        session.log( "Response: " + response );
        session.send( response );
    }
}
