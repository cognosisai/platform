import { proxyActivities, uuid4 } from '@temporalio/workflow';

import * as llm from "../activities/llm";
import * as tokenizer from "../activities/tokenizer";

import {NLPCLOUD_TOKEN, OPENAI_TOKEN} from '../config';

const { generateText, generateTextOpenAI, retryGenerateTextOpenAI,  } = proxyActivities< typeof llm >({ startToCloseTimeout: '10 minute',  });
const { nlpcloud_tokenize, tokenize_native } = proxyActivities< typeof tokenizer >({ startToCloseTimeout: '10 minute',  });


/**
 * @function nlpcloud_generate
 * @param {string} prompt
 * @param {number} minLength
 * @param {number} maxLength
 * @param {boolean | null} lengthNoInput
 * @param {string | null} endSequence
 * @param {boolean} removeInput
 * @param {boolean | null} doSample
 * @param {number | null} numBeams
 * @param {boolean | null} earlyStopping
 * @param {number | null} noRepeatNgramSize
 * @param {number | null} numReturnSequences
 * @param {number | null} topK
 * @param {number | null} topP
 * @param {number | null} temperature
 * @param {number | null} repetitionPenalty
 * @param {number | null} lengthPenalty
 * @param {boolean | null} badWords
 * @param {boolean | null} removeEndSequence
 * @description A workflow that will generate text using the NLP Cloud API
 */
 export async function nlpcloud_generate(
    prompt: string,
    minLength: number = 10,
    maxLength: number = 20,
    lengthNoInput: boolean | null = null,
    endSequence: string | null = null,
    removeInput: boolean = true,
    doSample: boolean | null, 
    numBeams: number | null,
    earlyStopping: boolean | null,
    noRepeatNgramSize: number | null,
    numReturnSequences: number | null,
    topK: number | null,
    topP: number | null,
    temperature: number | null,
    repetitionPenalty: number | null,
    lengthPenalty: number | null,
    badWords: boolean | null,
    removeEndSequence: boolean | null,
    ): Promise<string> {

      // TODO: #3 Where do we want to store stuff like API tokens?
  return await generateText( 'finetuned-gpt-neox-20b', prompt, NLPCLOUD_TOKEN,
      minLength, maxLength, lengthNoInput, endSequence, removeInput, doSample, numBeams, earlyStopping,
      noRepeatNgramSize, numReturnSequences, topK, topP, temperature, repetitionPenalty, lengthPenalty,
      badWords, removeEndSequence );
}

/**
 * 
 * @function nlpcloud_tokens
 * @param {string} text
 * @description A workflow that will tokenize text using the NLP Cloud API
 */
export async function nlpcloud_tokens( text: string ): Promise< tokenizer.NLPCloudToken[] >
{
  return nlpcloud_tokenize( text, NLPCLOUD_TOKEN );
}

/**
 * @function openai_generate
 * @param {string} prompt
 * @param {string} apikey
 * @param {number} min_length
 * @param {number} max_length
 * @param {number} temperature
 * @param {number} top_p
 * @description A workflow that will generate text using the OpenAI API
 */
export async function openai_generate( prompt: string, apikey: string, min_length: number, max_length: number, temperature: number, top_p: number ): Promise< string >
{
  return await generateTextOpenAI( prompt, apikey, min_length, max_length, temperature, top_p );
}

/**
 * @function minGenerate
 * @param {string} prompt
 * @param {number} minLength
 * @param {number} maxLength
 * @param {number} temperature
 * @param {string | null} endSequence
 * @param {"gpt-3" | "gpt-neox-20b"} model
 * @description A workflow that will generate text using sensible defaults to a sensible default LLM
 */
export async function minGenerate( prompt: string, minLength: number, maxLength: number, temperature: number, endSequence: string | null = null,  model: "gpt-3" | "gpt-neox-20b" = "gpt-3" ): Promise< string >
{
  console.log( "In:\n" + prompt );
  if ( model == "gpt-neox-20b" )
  {
    let completion = await nlpcloud_generate( prompt, minLength, maxLength, true, endSequence, undefined, null, null, null, null, null, null, 1.0, temperature, null, null, null, true );
    console.log( "Out:\n" + completion );
    return completion;
  }
  else if ( model == "gpt-3" )
  {
    let completion = await openai_generate( prompt, OPENAI_TOKEN, minLength, maxLength, temperature, 0.9 );
    return( completion );
  }

  throw new Error (`No model ${model} found`);
}

