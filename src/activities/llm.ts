import axios from 'axios';
import { Configuration, OpenAIApi } from "openai";
import fs from 'fs';
// Import json5

/**
 * @function generateText
 *
 * @param {string} modelName Model to use for generation
 * @param {string} text Text to use as prompt (input)
 * @param {string} token API token
 * @param {number} minLength Minimum length of generated text (not always respected by the model)
 * @param {number} maxLength Maximum length of generated text (this is respected by the model)
 * @param {boolean|null} lengthNoInput Calculate length based on prompt (input) text
 * @param {string|null} endSequence Stop generation when this sequence is encountered
 * @param {boolean} removeInput Remove prompt (input) text from generated text (don't touch this unless you know what you're doing)
 * @param {boolean|null} doSample Use sampling instead of greedy decoding (don't touch unless you know what you're doing)
 * @param {number|null} numBeams Number of beams for beam search (don't touch unless you know what you're doing)
 * @param {boolean|null} earlyStopping Stop when at least num_beams sentences are finished per batch (don't touch unless you know what you're doing)
 * @param {number|null} noRepeatNgramSize If set to int > 0, all ngrams of that size can only occur once (don't touch unless you know what you're doing)
 * @param {number|null} numReturnSequences Number of returned sequences for each element in the batch (don't touch unless you know what you're doing)
 * @param {number|null} topK Number of highest probability vocabulary tokens to keep for top-k-filtering (don't touch unless you know what you're doing)
 * @param {number|null} topP The cumulative probability of parameter highest probability vocabulary tokens to keep for nucleus sampling (don't touch unless you know what you're doing)
 * @param {number|null} temperature How much to temper the probabilities. 0.0 will generate the same text every time, 1.0 will generate random text. You usually probably want 0.0, but start tuning here if you're not getting good results.
 * @param {number|null} repetitionPenalty Penalty to apply if a sequence of words is repeated within a generated sequence (don't touch unless you know what you're doing)
 * @param {number|null} lengthPenalty Penalty to apply to the length of the sequence. (don't touch unless you know what you're doing)
 * @param {boolean|null} badWords
 * @param {boolean|null} removeEndSequence Remove end sequence from generated text (don't touch unless you know what you're doing)
 * @returns {Promise<string>} Generated text
 */
 export async function generateText(modelName: string,
    text: string, 
    token: string, 
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
    ) {
    const response = await axios.post(
      `https://api.nlpcloud.io/v1/gpu/${modelName}/generation`,
      {
        text: text,
        min_length: minLength,
        max_length: maxLength,
        length_no_input: lengthNoInput,
        end_sequence: endSequence,
        remove_input: removeInput,
        do_sample: doSample,
        num_beams: numBeams,
        early_stopping: earlyStopping,
        no_repeat_ngram_size: noRepeatNgramSize,
        num_return_sequences: numReturnSequences,
        topk: topK,
        topp: topP,
        temperature: temperature,
        repetition_penalty: repetitionPenalty,
        length_penalty: lengthPenalty,
        bad_words: badWords,
        remove_end_sequence: removeEndSequence,
      },
      {
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json"
        }
      }
    );
    return response.data.generated_text;
  }
  
  
  /**
   * Generates text using OpenAI's text completion API.
   * @param {string} text The text to use as a prompt.
   * @param {string} apikey The API key to use.
   * @param {number} min_length The minimum length of the generated text.
   * @param {number} max_length The maximum length of the generated text.
   * @param {number} temperature The temperature parameter for the text generation.
   * @param {number} top_p The top_p parameter for the text generation.
   * @returns {Promise<string>} The generated text.
   */
  export async function generateTextOpenAI( text: string, apikey: string, min_length: number, max_length: number, temperature: number, top_p: number, model : "text-davinci-002" | "code-davinci-002" | "text-curie-001" = "text-davinci-002", stopToken: string | string[] | null = null ): Promise< string >
  {
    const config = new Configuration({
      apiKey: apikey,
    });
    const openai = new OpenAIApi(config);
    const response = await openai.createCompletion( {"model": model, "prompt": text, "max_tokens": max_length, "temperature": temperature, "top_p": top_p, "frequency_penalty": 1.0, "presence_penalty": 1.0, stop: stopToken} );
    return( response.data.choices![0].text! );
  }
  
  
  export async function retryGenerateTextOpenAI( text: string, apikey: string, min_length: number, max_length: number, temperature: number, top_p: number, model : "text-davinci-002" | "code-davinci-002" | "text-curie-001" = "text-davinci-002", stopToken: string | string[] | null = null, delaySeconds = 1 ): Promise< string >
  {
    // Log everything to log/<timestamp>.log
    const log = fs.createWriteStream( `log/${new Date().toISOString()}.log`, { flags: 'a' } );
    log.write(`Min length: ${min_length} Max lenght: ${max_length} Temperature: ${temperature} Top_p: ${top_p} Model: ${model} Stop token: ${stopToken}\n`);
    log.write(`\n${text}\n`);
    console.log(`Min length: ${min_length} Max lenght: ${max_length} Temperature: ${temperature} Top_p: ${top_p} Model: ${model} Stop token: ${stopToken}`);
  
    await new Promise( resolve => setTimeout( resolve, Math.random() * 1500 ) );
  
    try
    {
      let result = await generateTextOpenAI( text, apikey, min_length, max_length, temperature, top_p, model, stopToken );
      console.log( `Result: ${result.length} retruend` );
      log.write(`\n=======================================\n${result}\n`);
      log.close();
      return result;
    }
    catch( error:any )
    {
      log.write(`\n=======================================\n${error}\n`);
      log.write(`\n=======================================\n${JSON.stringify(error.response.data)}\n`);
      log.close();
  
      if ( error.response && error.response.status == 429 )
      {
        let delay = Math.random() * 1000 * delaySeconds;
        console.log(`429. Waiting ${delay} ms and retrying.`);
        // Retry
        // Wait randomly up to 10 seconds
        await new Promise( resolve => setTimeout( resolve, delay ) );
        return await retryGenerateTextOpenAI( text, apikey, min_length, max_length, temperature, top_p, model, stopToken, delaySeconds ^ 2 );
      }
    }
  
    throw new Error( "Failed to generate text with non-temporary error" );
  }
  

