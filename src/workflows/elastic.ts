import { proxyActivities, uuid4 } from '@temporalio/workflow';

import * as elastic from '../activities/elastic';
const { es_index, es_mappings, es_search, } = proxyActivities<typeof elastic>({ startToCloseTimeout: '10 minute', });


/**
 * @function wf_esindex
 * @param {string} pindex
 * @param {any} pdocument
 * @description A workflow that will index a document into Elasticsearch
 */
 export async function wf_esindex( pindex: string, pdocument: any ): Promise< void >
 {
   await es_index( pindex, pdocument );
 }
 
 /**
  * @function wf_essearch
  * @param {string} index
  * @param {any} query
  * @description A workflow that will search Elasticsearch
  */
 export async function wf_essearch( index: string, query: any ): Promise< any >
 {
   let r = await es_search( index, query );
   return JSON.stringify(r);
 }

export async function esMappings( index: string, doc: any ): Promise< void >
{
  console.log(`Creating mappings for index ${index}: ${JSON.stringify(doc)}`);
  await es_mappings( index, doc, 512 );
}

