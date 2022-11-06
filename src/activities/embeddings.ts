import axios from 'axios';
import { Connection, WorkflowClient } from '@temporalio/client';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import fs from 'fs';
import {
  es_drop,
} from './elastic';

import { EMBEDDINGS_URL } from '../config';
import { embeddings_search } from './vector_search';

/**
 * @function nlp_embeddings_internal Internal function that calls the embeddings service 
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
    const response = await axios.post(EMBEDDINGS_URL, JSON.stringify(texts), {
      headers: {
        'Content-Type': 'application/json'
      }
    });

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
/**
 * @function convertVectorMapToObject Converts a Map<string, number[]> to an object
 * @param map Map<string, number[]> to convert
 * @returns {object} Object with keys as strings and values as arrays of numbers
 */
export const convertVectorMapToObject = (map: Map<string, number[]>): any => {
  let json: any = {};
  map.forEach((value: number[], index: string) => {
    json[index] = value;
  });
  return json;
};

/**
 * @function nlp_embeddings Generates embeddings for a list of texts
 * @param {string} modelName Name of the model to use
 * @param {string[]} texts List of texts to generate embeddings for
 * @example <caption> Generates embeddings for a list of texts</caption>
 * await nlp_embeddings('bert-base-uncased', ['hello world', 'goodbye world']);
 * @returns {Promise<Map<string, number[]>>}
 * @description Generates embeddings for a list of texts running as a Google Cloud Platform service in Vertex AI.
 */
export async function nlp_embeddings(
  modelName: string,
  texts: string[]
): Promise<[string, number[]][]> {
  let token;

  let retval: [string, number[]][] = [];
  try {
    const response = await axios.post(
      EMBEDDINGS_URL,
      JSON.stringify( texts ),
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
      retval.push([texts[x], obj[x]["vector"]]);
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
