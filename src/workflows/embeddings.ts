import axios from 'axios';
import * as elastic from '../activities/elastic';
import * as pembeddings from "../activities/embeddings";
import * as tokenizer from "../activities/tokenizer";
import * as util from "../activities/util";
import { proxyActivities, uuid4 } from '@temporalio/workflow';

const { nlp_embeddings_internal, convertVectorMapToObject, embeddings_search, embeddingsDrop, embeddingsSearch, nlp_embeddings } = proxyActivities< typeof pembeddings >({ startToCloseTimeout: '10 minute',  });
const { nlpcloud_tokenize, tokenize_native } = proxyActivities< typeof tokenizer >({ startToCloseTimeout: '10 minute',  });
const { es_index, es_drop } = proxyActivities< typeof elastic >({ startToCloseTimeout: '10 minute',  });
const { nlp_stable_diffusion } = proxyActivities< typeof util >({ startToCloseTimeout: '10 minute',  });


export async function embeddings( sentences: string[] ): Promise< [string, number[]][] >
{
  return nlp_embeddings( 'paraphrase-multilingual-mpnet-base-v2', sentences );
}


export async function storeEmbeddings( sentences: string[], index: string, documents: any[], alsoTokenize: boolean = false ): Promise< string >
{
  console.log(`Storing ${sentences.length} sentences.`);
  if ( documents.length != sentences.length )
  {
    throw Error("Error storing embeddings: sentences and documents are of different lengths" );
  }

  let e = (await embeddings( sentences ));

  for ( let x = 0; x < e.length; x ++ )
  {
    let doc = documents[x];
    console.log( doc );
    doc["embeddings"] = e[ x ][ 1 ];

    if ( alsoTokenize == true )
    {
      doc["tokens"] = await tokenize_native( sentences[x] );
    }

    console.log( doc )
    let doRefresh = false;
    if ( x == e.length - 1 ) doRefresh = true;
    await es_index( index, doc, doRefresh );
  }

  return `Status: OK. Stored ${sentences.length} embeddings.`;
}

export async function embeddingsFromTextSearch( index: string, text: string, k: number ): Promise< any[] >
{
  let v = <any> (await embeddings( [text] ));
  let vector = v[0][1];
  return embeddingsSearch( index, vector, k );
}
