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

  let wfid = 'workflow-' + nanoid();
  console.log(`Starting wfid ${wfid}`);
  const handle = await client.start(testSession, {
    // type inference works! args: [name: string]
    args: [{ts: new Date(), text: "Hello, world!", logs: []}],
    taskQueue: 'hello-world',
    // in practice, use a meaningful business id, eg customerId or transactionId
    workflowId: wfid,
  });

  let wait = await client.start( sendread, {args: [wfid, {text: argv[2] ?? "Hey, how are you?", ts: new Date(), logs: []}],taskQueue: 'hello-world', workflowId: `${wfid}-recv`} );
  console.log( await wait.result() );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
