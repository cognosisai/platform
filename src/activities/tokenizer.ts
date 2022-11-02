import axios from 'axios';


export interface NLPCloudToken
{
  text: string;
  lemma: string;
  start: number;
  end: number;
  ws_after: boolean;
}

async function nlpcloud_tokenize_x( text: string, token: string ): Promise< NLPCloudToken[] >
{
  const response = await axios.post(
    `https://api.nlpcloud.io/v1/en_core_web_lg/tokens`,
    {
      "text": text
    },
    {
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json"
      }
    }
  );
  return response.data.tokens;
}

export async function nlpcloud_tokenize( text: string, token: string ): Promise< NLPCloudToken[] >
{
  try
  {
    let x = await nlpcloud_tokenize_x( text, token );
    return x;
  }
  catch( e: unknown )
  {
    /*
        response: {
      status: 413,
      statusText: 'Payload Too Large',
      headers: [Object],
      config: [Object],
      request: [ClientRequest],
      data: 'Request Entity Too Large'
    }

    In this case, we want to split the problem up unto halves, and retry them all, and assemble the results. */
    if( e instanceof Error && (e as any).response?.status === 413 )
    {
      let half = Math.floor( text.length / 2 );
      console.log( "Cut in half." );
      let left  = await nlpcloud_tokenize( text.substr( 0, half ), token );
      let right = await nlpcloud_tokenize( text.substr( half + 1 ), token );

      return [ ...left, ...right ];
    }

    throw e; // rethrow the error for now... we'll see how this goes! :)
  }
}

/**
 * Convert string to list of tokens. This is used by the other LLM activities, largely by the
 * data/prompt split/map/reduce activities. You can use it directly if you want, but it's probably
 * best to use higher-level activities and/or workflows.
 * 
 * @param text Text to use as prompt (input)
 * @returns Array of tokens
 */
export async function tokenize_native( text: string ): Promise< string[] >
{
  var natural = require('natural');
  let tokenizer = new natural.TreebankWordTokenizer();
  return tokenizer.tokenize( text );
}

