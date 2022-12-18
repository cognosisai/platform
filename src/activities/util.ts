import axios from 'axios';
import { Connection, WorkflowClient } from '@temporalio/client';
import { nanoid } from 'nanoid';
import * as csv_parse from 'csv-parse';

import { getElasticSearchClient } from './elastic';

import { TEMPORAL_HOST, NLPCLOUD_TOKEN } from '../config';
import * as config from '../config';
import * as wf from '../workflows';

export async function nlp_stable_diffusion(
  prompt: string
): Promise<string> {
  const response = await axios.post(
    `https://api.nlpcloud.io/v1/gpu/stable-diffusion/image-generation`,
    {
      text: prompt
    },
    {
      headers: {
        Authorization: `Token ${NLPCLOUD_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.url;
}

export async function actionLogger(msg: string) {
  console.log(msg);
  // Store it in elasticsearch under the 'actionLogger' context:
  let client = await getElasticSearchClient();
  await client.index({ index: 'actionlogger', body: { message: msg } });
  client.close();
}

/**
 *
 * @param {string} url
 * @param {string} method
 * @param {any} headers
 * @param {any} data
 */
export async function wf_axios(
  url: string,
  method: string,
  headers: any,
  data: any
): Promise<any> {
  let r = await axios.request({
    url: url,
    method: method,
    headers: headers,
    data: data
  });
  return r.data;
}

export async function md5sum(string: string): Promise<string> {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(string).digest('hex');
}

/**
 * @function executeWorkflow
 * @param {string} address
 * @param {string} workflowId
 * @param {string} taskQueue
 * @param {any[]} args
 * @description Triggers a new workflow execution
 */
export async function executeWorkflow<T>(
  address: string,
  workflowId: string,
  taskQueue: string,
  args: any[]
): Promise<T> {
  const connection = await Connection.connect({ address: address });
  const client = new WorkflowClient({ connection });
  let r = await client.start(workflowId, {
    args: args,
    taskQueue: taskQueue,
    workflowId: 'workflow-' + nanoid()
  });
  let result = await r.result();
  return result;
}

export async function executeLocalWorkflow<T>(
  workflowId: string,
  taskQueue: string,
  args: any[]
): Promise<T> {
  return executeWorkflow(TEMPORAL_HOST, workflowId, taskQueue, args);
}

export async function JStoOBJ< T >( text: string ): Promise< T > {

    text = text.replace( /“/g, '"' );
    text = text.replace( /”/g, '"' );
    text = text.replace( /‘/g, "'" );
    text = text.replace( /’/g, "'" );
    console.log(`============\n${text}\n============\n`)

    try
    {
        let obj = eval( "const obj = " + text + " ; obj");
        console.log( obj );
        return obj;
    }
    catch( e: any )
    {
        console.log( e );
        let p = `Bad JS [{{{id}}}]:
const obj = {{{text}}}

Error:
{{{error}}}

Corrected JS, stripped of comments, and pretty-printed:
const obj =`;
        const connection = await Connection.connect( {address: config.TEMPORAL_HOST} );
        const client = new WorkflowClient({connection});

        let handle = await client.start(wf.promptTemplate, {
            args: [p, {text: text, error: e.toString(), id: nanoid()}, 128, 2048, 1.0, "finetuned-gpt-neox-20b"],
            taskQueue: 'hello-world',
            workflowId: nanoid(),
            workflowRunTimeout: '1 minutes',
        });

        let fixed = await handle.result();
        return await JStoOBJ( fixed );
    }
}


export async function parse_and_fix_csv( text: string ): Promise< any >
{
    console.log( "======> Entering parse_and_fix_csv" );
    // if text, which is a multi-line string, does not end in a " then add one
    if ( text[text.length-1] != '"' )
    {
        text += '"';
    }
    console.log( text );
    console.log( "======> Calling csv_parser_action")
    try
    {
        let parsed = await csv_parser_action( text );
        console.log( parsed );
        return( parsed );
    }
    catch( e: any )
    {
        console.log( "======> Error in parse_and_fix_csv" + e.toString() );
        const connection = await Connection.connect( {address: config.TEMPORAL_HOST} );
        const client = new WorkflowClient({connection});
        let wfid = "parse_and_fix_csv-" + nanoid();

        let p =
        `Bad CSV:

{{{csv}}}

Corrected CSV:
"`;

        let handle = await client.start(wf.promptTemplate, {
            args: [p, {csv: text}, 48, 1024, 0.0, "gpt-3"],
            taskQueue: 'hello-world',
            workflowId: wfid,
            workflowRunTimeout: '10 minutes',
        });
        let fixed = await handle.result();
        console.log( fixed );
        let parsed = await csv_parser_action( fixed );
        console.log( parsed );
        return parsed;
    }

}


export async function csv_parser_action( csv: string ): Promise< any[] >
{
    // if text, which is a multi-line string, does not end in a " then add one
    if ( csv[csv.length-1] != '"' )
    {
        csv += '"';
    }

    // if text does not begin with a " then add one
    if ( csv[0] != '"' )
    {
        csv = '"' + csv;
    }

    // Wrap below in a Promise
    let p = new Promise< any[] >( (resolve, reject) => {
        csv_parse.parse( csv, {columns: true, skip_empty_lines: true, relaxQuotes: true, relax_column_count: true}, (err, records) => {
            if ( err ) reject( err );
            resolve( records );
        } );
    } );
    return await p;
}
