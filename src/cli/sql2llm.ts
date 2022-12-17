import { Connection, WorkflowClient } from '@temporalio/client';
import { SQL2LLM } from '../workflows';
import { nanoid } from 'nanoid';
import fs from 'fs';
import { argv } from 'process';
import * as config from '../config';
import cli_table from 'cli-table3';

async function run() {
  const connection = await Connection.connect( {address: config.TEMPORAL_HOST} );
  const client = new WorkflowClient({
    connection
  });

  if ( true ) {
    // load file from disk in argv0
    let text = null;
    let natural_language_request = true;
    if ( argv.length == 5 )
    {
      const file = fs.readFileSync( argv[4] );
      text = file.toString();
    }

    let handle = await client.start(SQL2LLM, {
      // type inference works! args: [name: string]
      args: [ argv[2], argv[3], text, natural_language_request ],
      taskQueue: 'hello-world',
      // in practice, use a meaningful business id, eg customerId or transactionId
      workflowId: nanoid(),
      workflowRunTimeout: '10 minutes',
    });

    let result = await (await handle.result()).result;
    if ( result.length == 0 )
    {
      console.log( "No results." );
      process.exit( 0 );
    }
    let keys = Object.keys( result[0] );
    var table = new cli_table( {head: keys } );

    result.forEach( (v, i, a) => {
      table.push( <any> Object.values(v) );
    });

    console.log( table.toString() );
  }


}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
