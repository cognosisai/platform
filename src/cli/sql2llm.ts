import { Connection, WorkflowClient } from '@temporalio/client';
import { SQL2LLM } from '../workflows';
import { nanoid } from 'nanoid';
import fs from 'fs';
import { argv } from 'process';
import * as config from '../config';
import cli_table from 'cli-table3';

const yargs = require('yargs');

const options = yargs
    .usage('Usage: sql2llm -d <database name> [-n] -q <query> [ -f <file>] [-j] [-c]')
    .option('d', {
        alias: 'database-name',
        description: 'Name of the database to query',
        type: 'string',
        demandOption: true
    })
    .option('n', {
        alias: 'natural-language-request',
        description: 'Option to process <query> as natural language into a nSQL Natural Language Query',
        type: 'boolean'
    })
    .option('q', {
        alias: 'query',
        description: 'SQL query to run',
        type: 'string',
        demandOption: true
    })
    .option('f', {
        alias: 'file',
        description: 'Option to include <file> as data to query in context',
        type: 'string'
    })
    .option('j', {
        alias: 'json',
        description: 'Return results as JSON instead of displaying with cli-table3',
        type: 'boolean'
    })
    .option('c', {
        alias: 'csv',
        description: 'Return results as CSV instead of displaying with cli-table3',
        type: 'boolean'
    })
    .argv;

async function run() {
  const connection = await Connection.connect( {address: config.TEMPORAL_HOST} );
  const client = new WorkflowClient({
    connection
  });

  if ( true ) {
    // load file from disk in argv0
    let text = null;
    if ( options.file )
    {
      const file = fs.readFileSync( options.file );
      text = file.toString();
    }

    let handle = await client.start(SQL2LLM, {
      // type inference works! args: [name: string]
      args: [ options.databaseName, options.query, text, options['natural-language-request'] ],
      taskQueue: 'hello-world',
      // in practice, use a meaningful business id, eg customerId or transactionId
      workflowId: nanoid(),
      workflowRunTimeout: '30 seconds',
    });

    let output = await handle.result();
    let result = output.result;
    if ( result.length == 0 )
    {
      console.log( "No results." );
      process.exit( 0 );
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (options.csv) {
      const json2csv = require('json2csv');

      const fields = Object.keys( result[0] );
      const opts = { fields };
      try {
        const csv = json2csv.parse(result, opts);
        console.log(csv);
      } catch (err) {
        console.error(err);
      }
    } else {
      let keys = Object.keys( result[0] );
      var table = new cli_table( {head: keys} );

      result.forEach( (v, i, a) => {
        table.push( <any> Object.values(v) );
      });

      if ( output.nSQL_query )
        console.log( `Query: ${output.nSQL_query}` );
      console.log( table.toString() );
      console.log( `${result.length} rows with ${keys.length} columns returned.` );
    }
  }


}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});