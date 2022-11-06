import { getElasticSearchClient, es_query, es_drop,  } from './elastic';
import { esMappings } from '../workflows/elastic';

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
              source: "cosineSimilarity(params.queryVector, 'embeddings') + 1.0",
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
 * @function es_context For a given Elasticsearch line-vectorized index, filename and line number, provides the four lines of textual context
 * @param {string} indexname Elasticsearch index the document will be added to
 * @param {string} path Path to the file
 * @param {number} line Line number
 * @example <caption> Provides lines 8 to 12 from test.txt in the test line-vectorized Elasticsearch index </caption>
 * await es_context('test', 'test.txt', 10);
 * @returns {Promise<any>} Promise that resolves to the results of the search
 * @description Searches an index in ElasticSearch
 */export async function es_context(
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
 * @function es_mappings Creates an Elasticsearch index with a dense vector index at 'embeddings'
 * @param {string} index Elasticsearch index the document will be added to
 * @param {any} doc Elasticsearch mapping object
 * @param {number} dims Number of dimensions for the dense vector
 * @example <caption> Creates an Elasticsearch index with a dense vector</caption>
 * await es_mappings('test', { 'message': { 'type': 'text' } }, 512);
 * // Creates the following index:
 * // {
 * //   "mappings": {
 * //     "properties": {
 * //       "message": {
 * //         "type": "text"
 * //       },
 * //       "embeddings": {
 * //         "type": "dense_vector",
 * //         "dims": 512
 * //       }
 * //     }
 * //   }
 * // }
 * @returns {Promise<void>} Promise that resolves when the index is created
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

  client.close();
  return;
}


/**
 * @function init_elasticsearch_mappings Initializes the Elasticsearch mappings for the emmap database
 * @example <caption> Initializes the Elasticsearch mappings for the emmap database</caption>
 * await init_elasticsearch_mappings();
 * @returns {Promise<void>} Promise that resolves when the mappings are initialized
 */
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
