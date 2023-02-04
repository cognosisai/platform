import axios from 'axios';

export interface NLPCloudToken {
  text: string;
  lemma: string;
  start: number;
  end: number;
  ws_after: boolean;
}

async function nlpcloud_tokenize_x(
  text: string,
  token: string
): Promise<NLPCloudToken[]> {
  const response = await axios.post(
    `https://api.nlpcloud.io/v1/en_core_web_lg/tokens`,
    {
      text: text
    },
    {
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data.tokens;
}

export async function nlpcloud_tokenize(
  text: string,
  token: string
): Promise<NLPCloudToken[]> {
  try {
    let x = await nlpcloud_tokenize_x(text, token);
    return x;
  } catch (e: unknown) {
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
    if (e instanceof Error && (e as any).response?.status === 413) {
      let half = Math.floor(text.length / 2);
      console.log('Cut in half.');
      let left = await nlpcloud_tokenize(text.substr(0, half), token);
      let right = await nlpcloud_tokenize(text.substr(half + 1), token);

      return [...left, ...right];
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
export async function tokenize_native(text: string): Promise<string[]> {
  var natural = require('natural');
  let tokenizer = new natural.TreebankWordTokenizer();
  return tokenizer.tokenize(text);
}

export async function gpt3_tokenize(text: string): Promise<number[]> {
  let tokenizer = require('gpt-3-encoder');
  let encoded_tokens: number[] = tokenizer.encode(text);
  return encoded_tokens;
}

export async function gpt3_detokenize(tokens: number[]): Promise<string> {
  let tokenizer = require('gpt-3-encoder');
  let text = tokenizer.decode(tokens);
  return text;
}

/**
 * Split text into chunks of the given token size.
 * Adjacent chunks will overlap by chunk_overlap tokens, which can naively help avoid splitting
 * in bad places.
 * 
 * @param text string to split into chunks
 * @param chunk_size number of tokens per chunk (last chunk may be smaller)
 * @param chunk_overlap number of tokens to overlap adjacent chunks. defaults to 0.
 */
export async function split_text_by_tokens(text: string, chunk_size: number, chunk_overlap: number = 0): Promise<string[]> {
  if (chunk_size < 0) {
    throw new Error("chunk_size must be non-negative");
  }
  if (chunk_overlap < 0) {
    throw new Error("chunk_overlap must be non-negative");
  }
  if (chunk_overlap >= chunk_size) {
    throw new Error("chunk_overlap must be less than chunk_size");
  }

  let chunks: string[] = [];
  let text_tokens: number[] = await gpt3_tokenize( text );
  console.log(`Tokenized ${text.length} characters into ${text_tokens.length} tokens.`);

  // window slides by chunk_size - chunk_overlap tokens each iteration.
  // we stop sliding when a chunk includes the last token
  let tok_len = text_tokens.length;
  for ( let idx = 0;
        idx < tok_len && idx + chunk_overlap < tok_len; // rhs of && ensures last token only included once
        idx += chunk_size - chunk_overlap )
  {
      let context_tokens_slice: number[] = text_tokens.slice(idx, idx + chunk_size);
      let context_slice = await gpt3_detokenize( context_tokens_slice );
      chunks.push( context_slice );
  }
  return chunks;
}

export async function sentence_tokenizer( text: String ): Promise< string[] > {
  throw new Error("Not implemented" );
}
