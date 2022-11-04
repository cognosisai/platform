import { proxyActivities } from '@temporalio/workflow';
import { default as mustache } from 'mustache';

import * as llm from './llm';
import * as elastic from '../activities/elastic';
import * as tokenizer from '../activities/tokenizer';

import { logger } from './util';
import { embeddingsFromTextSearch } from './embeddings';

const { tokenize_native } = proxyActivities<
  typeof tokenizer
>({ startToCloseTimeout: '10 minute' });
const { es_context } = proxyActivities<typeof elastic>({
  startToCloseTimeout: '10 minute'
});

export async function promptTemplate<T>(
  template: string,
  variables: T,
  minLength: number = 1,
  maxLength: number = 50,
  temperature: number = 0.0,
  model: 'gpt-3' | 'gpt-neox-20b' = 'gpt-neox-20b'
): Promise<string> {
  console.log("OK, got into promptTemplate")
  let prompt = mustache.render(template, variables);
  console.log("Rendered mustache:\n" + prompt);
  let response = await llm.minGenerate(
    prompt,
    minLength,
    maxLength,
    temperature,
    model
  );
  console.log("Got response:\n" + response);
  return response;
}

const token_word_ratio = 0.5;
/**
 * @function splitPromptTemplateByTokens
 * @param data
 * @param template
 * @param minLength
 * @param maxLength
 * @param temperature
 * @returns
 */
export async function splitPromptTemplateByTokens(
  data: string,
  template: string,
  minLength: number = 1,
  maxLength: number = 50,
  temperature: number = 0.0
): Promise<Array<[string, string]>> {
  let template_token_length = await tokenize_native(template).then(
    (r) => r.length
  );

  let max_tokens = 1024;
  let tokens_left = max_tokens - maxLength - template_token_length;
  let tokens = await tokenize_native(data);

  let token_count = Math.floor(tokens_left * token_word_ratio);
  let token_split = splitUp(tokens, token_count);
  let token_split_promises = token_split.map(async (t) => {
    let p = await promptTemplate(
      template,
      { chunk: t.join(' ') },
      minLength,
      maxLength,
      temperature
    );
    return [t.join(' '), p];
  });
  let token_split_results = await Promise.all(token_split_promises);
  let finalret = new Array<[string, string]>();
  token_split_results.map((r) => {
    finalret.push([r[0], r[1]]);
  });

  return finalret;
}

export async function splitPromptTemplateByLinesOfTokens(
  data: string,
  template: string,
  minLength: number = 1,
  maxLength: number = 50,
  temperature: number = 0.0
): Promise<Array<[string, string, number[]]>> {
  let template_token_length = await tokenize_native(template).then(
    (r) => r.length
  );

  let max_tokens = 1768;
  let tokens_left = max_tokens - maxLength - template_token_length;
  let lines: Array<string> = data.split('\n');

  // Loop through lines and add them to a prompt until it fills up max_tokens, and then run it through promptTemplate
  let current_lines: string = '';
  let current_lines_tokens = 0;
  let current_lines_linenos: number[] = [];
  let chunks = new Array<[string, number[]]>();

  for (let i = 0; i < lines.length; ++i) {
    let tokens = await tokenize_native(lines[i]);
    if (current_lines_tokens + tokens.length <= tokens_left) {
      current_lines_linenos.push(i);

      if (current_lines == '') {
        current_lines += lines[i];
      } else {
        current_lines += '\n' + lines[i];
      }
      current_lines_tokens += tokens.length;
    } else {
      chunks.push([current_lines, current_lines_linenos]);
      current_lines_tokens = 0;
      current_lines = '';
      current_lines_linenos = [];
      // i --; // Rerun the line  TODO: fix somehow
    }
  }

  if (current_lines.length > 0) {
    chunks.push([current_lines, [...current_lines_linenos, lines.length]]);
  }

  console.log(`We are processing ${chunks.length} chunks`);

  /*   let template_token_length = await tokenize_native(template).then(
     (r) => r.length
   );
 
 */

  let allchunks = chunks.map(
    async (chunk, i, a): Promise<[string, string, number[]]> => {
      let p = promptTemplate(
        template,
        { chunk: chunk[0] },
        minLength,
        maxLength,
        temperature
      );
      return [chunk[0], await p, chunk[1]];
    }
  );

  return Promise.all(allchunks);
}

function splitUp<T>(arr: T[], size: number): T[][] {
  var newArr = [];
  for (var i = 0; i < arr.length; i += size) {
    newArr.push(arr.slice(i, i + size));
  }
  return newArr;
}

export async function promptReducer(
  inPrompt: string,
  variables: any,
  preamble: string,
  instructions: string
): Promise<string> {
  let xprompt = mustache.render(inPrompt, variables);
  return xprompt;

  //   let r = await promptTemplate(
  // `{{{preamble}}}
  // \`\`\`
  // {{{inPrompt}}}
  // \`\`\`
  // {{{instructions}}}`, {inPrompt: xprompt, preamble: preamble, instructions: instructions}, 10, 2000, 1 );

  // return r;
}

export async function translateQuerySpaceToAnswerSpace(
  query: string
): Promise<string> {
  let p = `Translate from "query space" to "answer space" while preserving the unknowns as variables.
  
  Query: How old is my dog?
  Answer: My dog is <age> years old.
  
  Query: What's John's daughter's name?
  Answer: John's daughter's name is <name>.
  
  Query: {{{query}}}
  Answer:`;

  let result = await promptTemplate(p, { query: query }, 2, 50, 0.0);
  return result;
}

export async function keywordsFromQuery(query: string): Promise<string> {
  let p = `We are going to extract full-text search queries for the following query:
  
  Query: {{{query}}} 
  
  Extract all of the relevant keywords, as well as any related keywords that you think might be useful. Separate each keyword with a comma:
  `;

  let result = await promptTemplate(p, { query: query }, 2, 50, 0.0);
  return result;
}

export interface QandA {
  question: string;
  answer: string;
  source_path: string;
  source_line: number;
}

export async function questionAndAnswer(
  index: string,
  query: string
): Promise<QandA> {
  // Translate to answer space
  //let answer = await translateQuerySpaceToAnswerSpace( query );

  // Search for the answer within the index from embeddingsFromTextSearch
  let results = await embeddingsFromTextSearch(
    index,
    await keywordsFromQuery(query),
    5
  );
  // Iterate through results, and use esquery to find and stitch together nearby lines
  let context: string[] = [];
  for (let r of results) {
    let nearbylines = await es_context(index, r._source.path, r._source.line);
    //let nearbylines = await es_query( `select * from ${index} limit 5` );
    for (let n of <any[]>nearbylines) {
      context.push(n.text);
    }
  }

  let prompt = `Here is a question:
  
  Question: {{{query}}}
  
  Potentially relevant semantic search results:
  
  {{{context}}}
  
  Output a JSON document which includes the following keys: [answer, answer_source, additional_answer_information, "answer_state (complete, partial, unknown)", "answer_confidence (1-100%)" ]
  
  { "answer": "`;
  let result =
    `{ "answer": "` +
    (await promptTemplate(
      prompt,
      { query: query, context: context.join('\n') },
      2,
      250,
      0.0
    ));
  try {
    let sresult = JSON.parse(result);
    return sresult;
  } catch (e: any) {
    let fixed = await fixJSON(result);
    return JSON.parse(fixed);
  }
}

async function fixJSON(text: string): Promise<string> {
  let result = await promptTemplate(
    `Fix the following JSON:
  
  {{{text}}}`,
    { text: text },
    2,
    1000,
    0.0
  );

  return result;
}

async function testAnswerFromQuestion(
  question: string,
  answer: string
): Promise<boolean> {
  let p = `Question: {{{question}}}
  Answer: {{{answer}}}
  
  Is the answer correct? yes/no:`;
  let result = await promptTemplate(
    p,
    { question: question, answer: answer },
    2,
    5,
    0.0
  );
  return result.toLowerCase().indexOf('yes') >= 0;
}

/**
 *
 * @param text Text to summarize which is potentially larger than the context-size of the LLM model
 * @param primarySummarizeTemplate Template to use for the map step summary
 * @param reduceSummarizeTemplate Teomplate to use for the reduce step summary
 * @returns A summary of the text
 */
export async function mapreduce_summary(
  text: string,
  primarySummarizeTemplate: string = 'Analyze the following text for a detailed summary.\n\n{{{chunk}}}\n\nProvide a detailed summary:',
  reduceSummarizeTemplate: string = 'These are a series of summaries that you are going to summarize:\n\n{{{chunk}}}\n\nProvide a detailed summary in the 3rd party passive voice, removing duplicate information:'
): Promise<string> {
  if (text == null || text.length == 0) return '';

  let completions = await mapPromptTemplate(text, primarySummarizeTemplate);
  return reducePromptTemplate(completions, reduceSummarizeTemplate);
}

/**
 * mapreduce_question_text
 * @param text Text to be processed
 * @param primaryQuestionTemplate Template for the primary question
 * @param reduceQuestionTemplate Template for the reduce question
 * @returns A promise that resolves to the final answer
 */
export async function mapreduce_question_text(
  text: string,
  question: string,
  primarySummarizeTemplate: string = `Read the following text:\n\n{{{chunk}}}\n\nQuestion:\n\n${question}\n\nAnswer:`,
  reduceSummarizeTemplate: string = `Question: ${question}\nPossible Answers:\n{{{chunk}}}\n\\n\nQuestion: ${question}\nBest Answer:`
): Promise<string> {
  if (text == null || text.length == 0) return '';

  let completions = await mapPromptTemplate(text, primarySummarizeTemplate);
  let possible_answers = completions.map(
    ([c, p, l], i, a) => `Possible Answer: "${c}"\n`
  );
  return reducePromptTemplate(completions, reduceSummarizeTemplate);
}

/**
 * mapPromptTemplate
 * @param text Input text to be processed
 * @param primarySummarizeTemplate Prompt template run on each chunk of text
 * @returns List of completions from running prompt primarySummarizeTemplate on each chunk of text
 */
export async function mapPromptTemplate(
  text: string,
  primarySummarizeTemplate: string = 'Analyze the following text for a detailed summary.\n\n{{{chunk}}}\n\nProvide a detailed summary:'
): Promise<string[]> {
  logger(`We are splitting a piece of text ${text.length} characters long.`);
  let summaries = await splitPromptTemplateByLinesOfTokens(
    text,
    primarySummarizeTemplate,
    5,
    1024,
    0.2
  );
  console.log(summaries);
  let completions = summaries.map(([c, p, l], i, a) => `${p}`);
  console.log(completions);
  return completions;
}

/**
 * reducePromptTemplate
 *
 * @param completions Array of completions, usually output from mapPromptTemplate
 * @param reduceTemplate Prompt template run on completions to reduce them to a single summary
 * @returns Final return value of the reduce prompt templates being run on completions from the map prompt templates.
 */
export async function reducePromptTemplate(
  completions: string[],
  reduceTemplate: string = 'These are a series of summaries that you are going to summarize:\n\n{{{chunk}}}\n\nProvide a detailed summary, but removing duplicate information:'
): Promise<string> {
  if (completions.length == 1) {
    return completions[0];
  }

  if (completions.length == 0) {
    return '<Nothing to summarize.>';
  }

  let iterations = 0;
  while (true) {
    logger(`Iteration ${iterations++}. We have ${completions.length} left.`);
    let summary = await splitPromptTemplateByLinesOfTokens(
      completions.join('\n\n'),
      reduceTemplate,
      500,
      1000,
      0.2
    );
    let summary_completions = summary.map(([p, c, l]) => `${c}\n\n`);
    if (summary_completions.length == 1) {
      return summary_completions[0];
    }
    completions = summary_completions;
  }
}
