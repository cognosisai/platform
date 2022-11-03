import axios from 'axios';
import { Connection, WorkflowClient } from '@temporalio/client';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import fs from 'fs';
import {
  getElasticSearchClient,
  es_context,
  es_delete,
  es_drop,
  es_index,
  es_mappings,
  es_query,
  es_search,
  init_elasticsearch_mappings
} from './elastic';

import { GOOGLE_SERVICE_KEY } from '../config';

/**
 *
 * @param {string} modelName
 * @param {string} token
 * @param {string[]} texts
 */
export async function nlp_embeddings_internal(
  modelName: string,
  token: string,
  texts: string[]
): Promise<Map<string, number[]>> {
  try {
    const response = await axios.post(
      `https://cognosisai-tshelloworld-embeddings-df52273-lp4f7jpena-uc.a.run.app`,
      JSON.stringify(texts),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    let r = new Map<string, number[]>();

    let obj = response.data;
    if (obj.length != texts.length) {
      throw new Error(
        `Embeddings generation error: texts were ${texts.length} long, while there were ${obj.length} embeddings returned`
      );
    }

    for (let x = 0; x < obj.length; x++) {
      r.set(texts[x], obj[x]['vector']);
    }

    return convertVectorMapToObject(r);
  } catch (e: any) {
    console.error(e.toString());
    throw new Error(`Embeddings generation error: ${e.toString()}`);
  }
}

// This might be the stupidest function I have ever written in my life. For this, I am deeply ashamed.
export const convertVectorMapToObject = (map: Map<string, number[]>): any => {
  let json: any = {};
  map.forEach((value: number[], index: string) => {
    json[index] = value;
  });
  return json;
};

export async function embeddings_search(
  indexname: string,
  vector: number[],
  k: number
): Promise<any> {
  console.log(`Searching for ${vector.length} in ${indexname} returning ${k}`);
  let client = await getElasticSearchClient();
  try {
    const result = await client.search({
      index: indexname,
      body: {
        query: {
          script_score: {
            query: { match_all: {} },
            script: {
              source:
                "cosineSimilarity(params.queryVector, 'embeddings') + 1.0",
              params: { queryVector: vector }
            }
          }
        },
        size: k
      }
    });
    return result.hits.hits;
  } catch (e: any) {
    console.error(e.meta.body.error);
    console.error('========================== Sahr');
    console.error(e.meta.body.error.failed_shards[0].reason);
    throw e;
  }
}

/**
 * @function nlp_embeddings
 * @param {string} modelName
 * @param {string[]} texts
 * @returns {Promise<Map<string, number[]>>}
 * @description Generates embeddings for a list of texts running as a Google Cloud Platform service in Vertex AI.
 */
export async function nlp_embeddings(
  modelName: string,
  texts: string[]
): Promise<[string, number[]][]> {
  let token;
  var spawn = require('child_process').spawn;
  process.env.GOOGLE_APPLICATION_CREDENTIALS =
    '../deploy/production/etc/cognosis-hello-world-5b28cb5111ff.json'; // TODO: Fix me
  /*var program = spawn('gcloud', ['auth', 'print-access-token']);
 
   // Add GOOGLE_APPLICATION_CREDENTIALS=/tmp/foo to the environment variables
   // to use the service account credentials.
 
   // Wait until the program has finished
   await new Promise<void>((resolve, reject) => {
 
     
 
     program.stdout.on('data', async (data: any) => 
     {
       token = data.toString();
       // Remove all dots and trailing newlines in token
       //token = token.replace(/\./g, '');
       token = token.replace(/\n/g, '');
       console.log( `Token: ${[token]}` );
       resolve();
     } 
     );
   });
   */

  const ENDPOINT_ID = '2008878112690929664';
  const PROJECT_ID = 'cognosis-hello-world';
  const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/endpoints/${ENDPOINT_ID}:predict`;

  async function getGCPAccessToken() {
    const { auth } = require('google-auth-library');
    let skey = GOOGLE_SERVICE_KEY;
    const client = auth.fromJSON(skey);
    client.scopes = ['https://www.googleapis.com/auth/cloud-platform'];
    const url = `https://dns.googleapis.com/dns/v1/projects/${PROJECT_ID}`;
    const res = await client.request({ url });
    return client.credentials.access_token;
  }

  token = await getGCPAccessToken();

  let retval: [string, number[]][] = [];
  try {
    const response = await axios.post(
      url,
      JSON.stringify({ instances: texts }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
    );

    let r = new Map<string, number[]>();
    let obj = response.data;
    if (obj.predictions.length != texts.length) {
      throw new Error(
        `Embeddings generation error: texts were ${texts.length} long, while there were ${obj.length} embeddings returned`
      );
    }

    for (let x = 0; x < obj.predictions.length; x++) {
      retval.push([texts[x], obj.predictions[x]]);
    }

    return retval;
  } catch (e: any) {
    console.error(e.toString());
    throw new Error(
      `Nu Embeddings generation error: ${e.toString()}\n${e.message}`
    );
  }
}

export async function embeddingsSearch(
  index: string,
  vector: number[],
  k: number
): Promise<any[]> {
  try {
    return embeddings_search(index, vector, k);
  } catch (e: any) {
    return [{ error: e.message }];
  }
}

export async function embeddingsDrop(index: string): Promise<void> {
  await es_drop(index);
}
