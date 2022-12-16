import * as wf from '../workflows';
import { Connection, WorkflowClient } from '@temporalio/client';
import { sendread,  } from '../workflows';
import * as config from '../config';
import { nanoid } from 'nanoid';

export async function sql2llm_session_multiplexer( message: wf.SQL2LLMInput ): Promise< wf.SQL2LLMOutput >
{
    const connection = await Connection.connect( {address: config.TEMPORAL_HOST} );
    const client = new WorkflowClient({connection});
    let wfid = `sqlllm_session_001-${Math.random()}`;
    let handle = client.getHandle( wfid );
    try
    {
        let d = await handle.describe(); // TODO: if it's dead, we want to start a new one anyway
        console.log( `Workflow ${wfid} already exists: ${d.status.code} ${d.status.name}` );
        if ( d.status.code != 1 )
        {
            throw new Error("Workflow is not running. Starting a new one.");
        }
    }
    catch( e: any )
    {
        console.log(`Starting wfid ${wfid}`);
        handle = await client.start(wf.SQL2LLM_session, {
            args: [message.dbname, message.fields],
            taskQueue: 'hello-world',
            workflowId: wfid,
            workflowRunTimeout: '10 minutes',
        });
    }

    let wait = await client.start( sendread, {args: [wfid, message], taskQueue: 'hello-world', workflowId: `${wfid}-${nanoid()}`, workflowRunTimeout: '1 minute'} );
    let result = await wait.result();
    return JSON.parse( result );
}
