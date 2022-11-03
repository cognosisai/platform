import axios from 'axios';
import { Client } from '@elastic/elasticsearch';
import { esMappings } from '../workflows/elastic';

import { ElasticConfig } from '../config';

/**
 * @function getElasticSearchClient
 * @param {any} elasticconfig
 * @returns {Promise<Client>}
 * @description Returns a promise that resolves to an ElasticSearch client
 */
export async function getElasticSearchClient(): Promise<Client> {
  const client = new Client(ElasticConfig);
  return client;
}

/**
 * @function es_index
 * @param {string} indexname
 * @param {any} doc
 * @param {boolean} refresh
 * @returns {Promise<void>}
 * @description Indexes a document in ElasticSearch
 */
// TODO: shut down the client when we're done with it
// TODO: maybe just wrap it in some sort of async function that returns a promise?
export async function es_index(
  indexname: string,
  doc: any,
  refresh = true
): Promise<void> {
  let client = await getElasticSearchClient();
  await client.index({ index: indexname, document: doc });
  if (refresh) await client.indices.refresh({ index: indexname });
  client.close();
  return;
}

/**
 * @function es_search
 * @param {string} indexname
 * @param {any} queryobj
 * @returns {Promise<any>}
 * @description Searches an index in ElasticSearch
 */
export async function es_search<T>(
  indexname: string,
  queryobj: any
): Promise<any> {
  let client = await getElasticSearchClient();
  const result = await client.search({ index: indexname, query: queryobj });
  client.close();
  return result.hits.hits;
}

/**
 * @function es_context
 * @param {string} indexname
 * @param {string} path
 * @param {number} line
 * @returns {Promise<any>}
 * @description Returns context around a line in a file
 */
export async function es_context(
  indexname: string,
  path: string,
  line: number
): Promise<any> {
  let client = await getElasticSearchClient();
  try {
    let sql = `SELECT text, line, path FROM ${indexname} WHERE path = '${path}' AND line >= ${line} - 2 AND line <= ${line} + 2 ORDER BY line ASC`;
    console.log(sql);
    let results = es_query(sql);
    client.close();
    return results;
  } catch (e: any) {
    console.log(e);
    console.log(e.meta.body.error);
    throw e;
  }
}

/**
 * @function es_query
 * @param {string} query
 * @returns {Promise<any>}
 * @description Runs a query against ElasticSearch
 */
export async function es_query<T>(query: string): Promise<any> {
  let client = await getElasticSearchClient();
  const result = await client.sql.query({
    query: query
  });
  client.close();
  const data = result.rows.map((row) => {
    const obj: any = {};
    for (let i = 0; i < row.length; i++) {
      obj[result.columns![i].name] = row[i];
    }
    return obj;
  });

  return data;
}

/**
 * @function es_mappings
 * @param {string} index
 * @param {any} doc
 * @param {number} dims
 * @returns {Promise<void>}
 * @description Sets mappings for an index in ElasticSearch, adding in embeddings
 */

export async function es_mappings(
  index: string,
  doc: any,
  dims: number
): Promise<void> {
  let client = await getElasticSearchClient();
  /*
    {"client_msg_id":"6dfbdabd-19f3-43b9-ad0a-bff20ddccae5","type":"message","text":"emmap messages","user":"U03UF3XNM8D","ts":"1662237512.586659","team":"T03U3FML84F","blocks":[{"type":"rich_text","block_id":"s+aM","elements":[{"type":"rich_text_section","elements":[{"type":"text","text":"emmap messages"}]}]}],"channel":"C0409CD6VR7","event_ts":"1662237512.586659","channel_type":"channel"}
    */
  let mappings = doc;
  mappings['embeddings'] = { type: 'dense_vector', dims: dims };
  try {
    await client.indices.create({
      index: index,
      mappings: { properties: doc }
    });
  } catch (e: any) {
    if (e.meta.body.error.type != 'resource_already_exists_exception') {
      throw e;
    }
  }

  //   {"embeddings": {"type" : "dense_vector", dims },
  //   "text": {"type": "text"},
  //   "user": {"type": "text"},
  //   "channel": {"type": "text"},
  //   "ts": {"type": "date"}
  // }}});
  client.close();
  return;
}

export async function es_drop(index: string): Promise<void> {
  let client = await getElasticSearchClient();
  try {
    await client.indices.delete({ index: index });
  } catch (e: any) {
    console.error(e);
  }
}

export async function es_delete(index: string, id: string): Promise<void> {
  let client = await getElasticSearchClient();
  try {
    await client.delete({ index: index, id: id });
  } catch (e: any) {
    console.error(e);
  }
}

export async function init_elasticsearch_mappings(): Promise<string> {
  try {
    await es_drop('messages');
  } catch (e: any) {}
  await esMappings('messages', {
    text: { type: 'text' },
    user: { type: 'keyword' },
    ts: { type: 'keyword' },
    channel: { type: 'keyword' },
    reactions: { type: 'keyword' }
  });

  try {
    await es_drop('teachings');
  } catch (e: any) {}
  await esMappings('teachings', {
    text: { type: 'text' },
    user: { type: 'keyword' },
    prompt: { type: 'keyword' },
    completion: { type: 'keyword' },
    prompt_leading: { type: 'keyword' },
    md5sum: { type: 'keyword' }
  });

  try {
    await es_drop('transcripts');
  } catch (e: any) {}
  await esMappings('transcripts', {
    filename: { type: 'keyword' },
    transcript: { type: 'text' },
    data: { type: 'keyword' }
  });

  try {
    await es_drop('spider');
  } catch (e: any) {}
  await esMappings('spider', {
    url: { type: 'keyword' },
    depth: { type: 'integer' },
    md5: { type: 'keyword' },
    text: { type: 'text' }
  });

  return 'Done init_elasticsearch_mappings().';
}
