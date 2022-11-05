import axios from 'axios';
import { Connection, WorkflowClient } from '@temporalio/client';
import { nanoid } from 'nanoid';

import { getElasticSearchClient } from './elastic';

import { TEMPORAL_HOST, NLPCLOUD_TOKEN } from '../config';

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
