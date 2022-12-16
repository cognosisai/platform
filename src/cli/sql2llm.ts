import { Connection, WorkflowClient } from '@temporalio/client';
import { SQL2LLM } from '../workflows';
import { nanoid } from 'nanoid';
import fs from 'fs';
import { argv } from 'process';
import * as config from '../config';

async function run() {
  const connection = await Connection.connect( {address: config.TEMPORAL_HOST} );
  const client = new WorkflowClient({
    connection
  });

  if ( true ) {
    // load file from disk in argv0
//    const file = fs.readFileSync( argv[2] );
//    const text = file.toString();
    

    let handle = await client.start(SQL2LLM, {
      // type inference works! args: [name: string]
      args: [ argv[2], argv[3] ],
      taskQueue: 'hello-world',
      // in practice, use a meaningful business id, eg customerId or transactionId
      workflowId: nanoid(),
      workflowRunTimeout: '10 minutes',
    });

    console.log( JSON.stringify(await (await handle.result()).result) );
    return;
  }


}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
