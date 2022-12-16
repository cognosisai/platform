import axios from 'axios';
import { Client } from '@elastic/elasticsearch';
import { esMappings } from '../workflows/elastic';

import { ELASTIC_CONFIG } from '../config';

/**
 * @function getElasticSearchClient
 * @param {any} elasticconfig
 * @example 
 * import { ELASTIC_CONFIG } from '../config';
 * const client = getElasticSearchClient(ELASTIC_CONFIG);
 * @returns {Promise<Client>} ElasticSearch client
 * @description Returns a promise that resolves to an ElasticSearch client
 */
export async function getElasticSearchClient(): Promise<Client> {
  const client = new Client(ELASTIC_CONFIG);
  return client;
}

/**
 * @function es_index
 * @param {string} indexname Elasticsearch index name the document will be added to
 * @param {any} doc Document to be added to the index
 * @param {boolean} refresh Refresh the index after adding the document. This can slow down indexing, but is useful if you need it to be searchable immediately.
 * @example <caption> Adds a document to an elasticsearch index </caption>
 * await es_index('test', { 'test': 'test' }, true);
 * @returns {Promise<void>}
 * @description Indexes a document in ElasticSearch
 */
// TODO: shut down the client on error
export async function es_index(
  indexname: string,
  doc: any,
  refresh: boolean = true
): Promise<void> {
  let client = await getElasticSearchClient();
  try
  {
    await client.index({ index: indexname, document: doc });
    if (refresh) await client.indices.refresh({ index: indexname });
    client.close();
  }
  catch( e: any )
  {
    console.error(e);
    client.close();
    throw( e );
  }

  return;
}

/**
 * @function es_search
 * @param {string} indexname Elasticsearch index the document will be added to
 * @param {any} queryobj Query object to be used to search the index
 * @example <caption> Searches an Elasticsearch index using ELastic Query DSL</caption>
 * await es_search('test', { 'query': { 'match_all': {} } });
 * @returns {Promise<any>} Promise that resolves to the results of the search
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
 * @function es_query Executes an SQL query against Elasticsearch
 * @param {string} query SQL query to be executed
 * @example <caption> Executes an SQL query against Elasticsearch</caption>
 * await es_query('SELECT * FROM test');
 * @returns {Promise<any>} Promise that resolves to the results of the query
 */export async function es_query<T>(query: string, params?: any): Promise<any> {
  let client = await getElasticSearchClient();
  const result = await client.sql.query({
    query: query,
    params: params,
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
 * @function es_drop Deletes an Elasticsearch index
 * @param index Elasticsearch index to be deleted
 * @example <caption> Deletes an Elasticsearch index</caption>
 * await es_delete('test');
 * @returns {Promise<void>} Promise that resolves when the index is deleted
 */
export async function es_drop(index: string): Promise<void> {
  let client = await getElasticSearchClient();
  try {
    await client.indices.delete({ index: index });
  } catch (e: any) {
    console.error(e);
  }
}

/**
 * @function es_delete Deletes a document from an Elasticsearch index
 * @param index Elasticsearch index the document will be deleted from
 * @param id ID of the document to be deleted
 * @example <caption> Deletes a document from an Elasticsearch index</caption>
 * await es_delete('test', '1');
 * @returns {Promise<void>} Promise that resolves when the document is deleted
 */
export async function es_delete(index: string, id: string): Promise<void> {
  let client = await getElasticSearchClient();
  try {
    await client.delete({ index: index, id: id });
  } catch (e: any) {
    console.error(e);
  }
}

