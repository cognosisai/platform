import { Connection, WorkflowClient } from '@temporalio/client';
import { testSession, sendread } from '../workflows/session';
import { nanoid } from 'nanoid';
import fs from 'fs';
import { argv } from 'process';
import * as config from '../config';

async function run() {
  const connection = await Connection.connect( {address: config.TEMPORAL_HOST} );
  const client = new WorkflowClient({
    connection
  });

  let wfid = 'workflow-chatbot-session-6';
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
    handle = await client.start(testSession, {
      // type inference works! args: [name: string]
      args: [{ts: new Date(), text: "Hello, world!", logs: []}],
      taskQueue: 'hello-world',
      // in practice, use a meaningful business id, eg customerId or transactionId
      workflowId: wfid,
      workflowRunTimeout: '10 minutes',
    });
  }

  let wait = await client.start( sendread, {args: [wfid, {text: argv[2] ?? "Hey, how are you?", ts: new Date(), logs: []}],taskQueue: 'hello-world', workflowId: `${wfid}-${nanoid()}`} );
  console.log( await wait.result() );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
