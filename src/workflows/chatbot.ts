import { default as mustache } from 'mustache';

import * as prompt from "./prompt";
import * as elastic from "../activities/elastic";
import * as util from '../activities/util';

import { proxyActivities, uuid4 } from '@temporalio/workflow';
import { ChatSession, Personality } from "../clones";
import { embeddingsFromTextSearch, translateQuerySpaceToAnswerSpace } from "../workflows";
import { storeEmbeddings } from "./embeddings";
import { minGenerate } from "./llm";
import { mapreduce_summary } from "./prompt";
import { Cog, Cogset } from '../cogs/cog';
import { TEMPORAL_HOST } from '../config';

const { promptReducer, promptTemplate } = proxyActivities<typeof prompt>({ startToCloseTimeout: '10 minute', });
const { es_query, init_elasticsearch_mappings, es_context, es_delete, es_drop, es_index, es_mappings, es_search, getElasticSearchClient } = proxyActivities<typeof elastic>({ startToCloseTimeout: '10 minute', });
const { actionLogger, md5sum, nlp_stable_diffusion, wf_axios, executeLocalWorkflow, executeWorkflow } = proxyActivities<typeof util>({ startToCloseTimeout: '10 minute', });

let personality_chuck: Personality = {
    name: "Chuck",
    personality:  `Chuck is a cowboy from Arlington, Texas. He speaks with a giant Texas drawl. He's a really nice guy. He got his degree from ITT in database administration. When he talks, it's very clear that he's from Texas. He says yeehaw and y'all a lot. He calls everyone ma'am regardless of who they are. Chuck is a great guy, very dilligent, and extremely helpful.`,
    instructions: [
    ],
  }
  
  let personaltiy_nlp: Personality = {
    name: "Nilp",
    personality: "Nilp is a 25th century sexbot. He can service men, women, and many differently gendered aliens. He knows a great deal about every kind of sex.",
    instructions: [
      "Use the context to try to get a better sense of what is being asked of you, but ignore it if it is not relevant."
    ]
  };
  
  
  export async function tooComplicatedChatbot( personality: Personality, context_length: number, user: string, message: string ): Promise< string >
  {
    interface ChatHistory
    {
      timestamp: Date;
      user: string;
      text: string;
    }
  
    let ch = new Array< ChatHistory >();
  
    try
    {
      let rows = await es_query( `SELECT ts, user, text FROM messages ORDER BY ts DESC LIMIT ${context_length}` );
      //let rows = await es_search( 'messages', { sort: [{ ts: { order: 'desc' } }], size: context_length } );
      //console.log( JSON.stringify(slack_history) );
      rows.map( (r: any) => {if ( r.user && r.text ) ch.push({timestamp: new Date(r.ts*1000), user: r.user, text: r.text})} )
      ch.reverse();
      let r = await NaturalLanguageRoutine< ChatHistory[], any >( ch, async (x) => {return JSON.stringify(x)}, personality.personality + "\n" + personality.instructions.join("\n"), 
          "", 
          (x) => {return JSON.parse('{ "bot_reply": "' + x)}, `Complete ${personality.name}'s response to ${user} as a complete JSON document: with the following keys:\n\nbot_reply: Chuck's reply to U03UF3XNM8D\n\n{ "bot_reply": "` );
  
      return JSON.stringify(r);
    }
    catch( e: any )
    {
      return "Error processing chatbot: " + e.toString();
    }
  }
  
  function parseFirstJSONDocuments( docs: string ) : any {
    var i = 0;
    while (i < docs.length) {
      if (docs.charAt(i) == '}') {
        try {
          return JSON.parse(docs.slice(0, i+1));
        }
        catch (err) {
        }
      }
      i++;
    }
  
    throw Error("No JSON documents found: " + docs);
  }
  
  interface ChatHistory
  {
    sender: string;
    message: string;
  }
  
  
  export async function xChatbot( personality: Personality, context_length: number, user: string, message: string, session: ChatSession = {personality: personality, user: user, messages: [], uuid: uuid4()}, json_mode: boolean = false ): Promise< string >
  {
    let fewshots = new Array< any >();
    try
    {
      let srows = await embeddingsFromTextSearch( "teachings", message, 100 );
      srows.map((r1: any) => {
        let r = r1._source; 
        if (fewshots.length < 5) {
          fewshots.push({ user: r.user, prompt: r.prompt, completion: r.completion });
        }
      });
      console.log(`We got ${fewshots.length} messages from the teachings search which we wittled down from ${srows.length} messages`);
    }
    catch( e: any )
    {
      console.log(`Error doing the teachings search: ${e.toString()}`);
    }
  
    let fewshots_a = fewshots.map( (r: any) => {
    // Use Mustache to render the prompt component
    let prompt = 
  `{{{user}}}: {{{prompt}}}
  {{{name}}}: {{{completion}}}\n`;
  
    let completion = r.completion;
    let user = r.user;
    let rendered_prompt = mustache.render( prompt, { user: r.user, prompt: r.prompt, completion: r.completion, name: personality.name } );
    return rendered_prompt;
  } );
    let fewshots_joined = fewshots_a.join("2e72b3\n");
  
    let ch = new Array< ChatHistory >();
  
    // Add in the last few messages from the user
    try
    {
      let rows = await es_query( `SELECT user, text FROM messages ORDER BY ts DESC LIMIT ${context_length}` );
      rows.reverse();
      //let rows = await es_search( 'messages', { sort: [{ ts: { order: 'desc' } }], size: context_length } );
      //console.log( JSON.stringify(slack_history) );
      rows.map( (r: any) => {if ( r.user && r.text && r.text.length < 300 ) ch.push({sender: r.user, message: r.text})} )
    }
    catch{}
  
  
  
    let p = '[ "Step 1:' + await promptTemplate(
      `Here is what ${user} said:
      ----
      {{{message}}}
      ----
      
      Here are some of the previous messages in the conversation:
      ----
      {{#context}}
      {{{sender}}}: {{{message}}}
      {{/context}}
          ----
      
      Here are some things you can do:
      ----
      {{{fewshots}}}
      ----
  
      Develop a 1-5 step plan to follow ${user}'s instructions, drawing on whatever capabilities you need:
  
      [ "Step 1:`, { message: message, fewshots: fewshots_joined, context: ch }, 10, 500, 0.0 );
    
      return p;
  }
  
  /**
   * @function
   * @param {string} message
   * @param {number} context_length
   * @param {string} user
   * @param {string} message
   * @param {ChatSession} session
   * @param {boolean} json_mode
   * @param {boolean} runCogs
   * @returns {Promise<string>}
   */
  export async function Chatbot( personality: Personality, context_length: number, user: string, message: string, session: ChatSession = {personality: personality, user: user, messages: [], uuid: uuid4()}, json_mode: boolean = false, runCogs: boolean = true ): Promise< string >
  {
    let original_message = message;
  
    let prompt_leading: string = "";
    if ( message.indexOf('|') != -1 )
    {
      let parts = message.split('|', 2);
      message = parts[0].trim();
      prompt_leading = parts[1].trim();
    }
  
    let ch = new Array< ChatHistory >();
  
    // Add in the last few messages from the user
    try
    {
      let rows = await es_query( `SELECT user, text FROM messages ORDER BY ts DESC LIMIT ${context_length}` );
      rows.reverse();
      //let rows = await es_search( 'messages', { sort: [{ ts: { order: 'desc' } }], size: context_length } );
      //console.log( JSON.stringify(slack_history) );
      rows.map( (r: any) => {if ( r.user && r.text && r.text.length < 300 ) ch.push({sender: r.user, message: r.text})} )
    }
    catch{}
  
    let extra_ch = new Array< ChatHistory >();
  
    let answermap: Map< string, number > = new Map();
  
    // Now we're going to add in a few messages from a semantic search
    try
    {
      console.log(`We're searching for messages that are similar to "${message}"`);
      // Invert the query into answer space
      let answer = await translateQuerySpaceToAnswerSpace( message );
      let srows = await embeddingsFromTextSearch( "messages", answer, 100 );
      // Resort srows by 'ts' property in ascending order
      srows.sort( (a: any, b: any) => { return a.ts - b.ts } );
  
      srows.map((r1: any) => {
        let r = r1._source; 
        if (r.user && r.text && !answermap.has( `${r.user}: ${r.text}`) && extra_ch.length < 20 && r.text.length < 300) {
          extra_ch.push({ sender: r.user, message: r.text });
          answermap.set(`${r.user}: ${r.text}`, 1);
        }
      });
      console.log(`We got ${extra_ch.length} messages from the semantic search which we wittled down from ${srows.length} messages`);
    }
    catch{}
  
    try
    {
      session.messages.map( (r: any) => {if ( r.user && r.text && !answermap.has( `${r.user}: ${r.text}`) && extra_ch.length < 20 ) ch.push({sender: r.user, message: r.text}); answermap.set(`${r.user}: ${r.text}`, 1);} )
    }
    catch{}
  
    // Last step: we're going to do a semantic search of potential teachings
    let fewshots = new Array< any >();
    try
    {
      let srows = await embeddingsFromTextSearch( "teachings", message, 100 );
      srows.map((r1: any) => {
        let r = r1._source; 
        if (fewshots.length < 5) {
          fewshots.push({ user: r.user, prompt: r.prompt, completion: r.completion });
        }
      });
      console.log(`We got ${fewshots.length} messages from the teachings search which we wittled down from ${srows.length} messages`);
    }
    catch( e: any )
    {
      console.log(`Error doing the teachings search: ${e.toString()}`);
    }
  
    if ( !json_mode )
    {
      let fewshots_a = fewshots.map( (r: any) => {
        // Use Mustache to render the prompt component
        let prompt = 
  `{{{user}}}: {{{prompt}}}
  {{{name}}}: {{{completion}}}\n`;
  
        let completion = r.completion;
        let user = r.user;
        let rendered_prompt = mustache.render( prompt, { user: r.user, prompt: r.prompt, completion: r.completion, name: personality.name } );
        return rendered_prompt;
      } );
      let fewshots_joined = fewshots_a.join("2e72b3\n");
  
  
      let r = minGenerate(
        await promptReducer(
  `{{{personality}}}
  
  Today's date is {{date}}.
  
  Recent chat history:
  {{#context}}
  {{{sender}}}: {{{message}}}
  {{/context}}
  
  Extra contextual chat history:
  {{#extra_context}}
  {{{sender}}}: {{{message}}}
  {{/extra_context}}
  
  Instructions:
  {{#instructions}}
  {{{.}}}
  {{/instructions}}
  
  {{{fewshots}}}
  {{{user}}}: {{{message}}}
  {{{name}}}:{{{prompt_leading}}}`,
  {user: user, date: new Date().toISOString(),message: message, personality: personality.personality, context: ch, extra_context: extra_ch, name: personality.name, instructions: personality.instructions, prompt_leading: prompt_leading, fewshots: fewshots_joined},
  "The following is a chatbot request:", "Remove ALL unnecessary information pertaining to the request:"),
  
    10, 250, 1 );
        let chat_response = prompt_leading + (await r);
        // Add this in the teachings index if there's prompt leading
        if ( prompt_leading.length > 0 )
        {
          await storeEmbeddings( [message], "teachings", [{ user: user, text: original_message, prompt: message, completion: chat_response, prompt_leading: prompt_leading  }] );
        }
  
        /* Add to chat history */
        session.messages.push( { user: user, text: original_message, response: chat_response, context: "", timestamp: new Date(), uuid: uuid4() } );
        
        if ( runCogs ) return( post_message_filtering(session) );
        return( chat_response );
    }
    else
    {
      let j = {
        personality: personality.personality,
        context: ch,
        instructions: personality.instructions,
        sender: user,
        message: message,
        reply_user: personality.name,
      }
      // Remove the last '}' from string j
      let k = JSON.stringify(j).toString().slice(0, -1);
      // Add the prompt_leading
      k += ", reply: \"" + prompt_leading;
      let r = await minGenerate( k, 5, 250, 1.0 );
      let rjs = "{ \"reply\": \"" + prompt_leading + r;
      let reret = parseFirstJSONDocuments( rjs );
      return( reret.reply );
    }
  }
  
  
  export async function ChatbotChuck( user: string, message: string ): Promise< string >
  {
    return await Chatbot(personality_chuck, 5, user, message );
  }
  
  export async function ChatbotNilp( user: string, message: string ): Promise< string >
  {
    return await Chatbot(personaltiy_nlp, 5, user, message );
  }
  
  type decode_function< IN > = (input: IN) => Promise< string >;
  type encode_function< OUT > = (output: string) => Promise< OUT >;
  
  /*
   * A natural language routine is a routine akin to deterministic programming subroutines, but with a natural language interface.
   * Each routine has a well defined interface for input parameters, output format, and natural language interface.
   * The input is an interface defined by the programmer, as is the output.
   *
   * As an example, we can define a natural language routine to function as a chatbot. Included in the input is some structured data, which includes the user, the message, and the context.
   * The output is also structured data, which includes the response, as well as any commands which the routine may execute.
   */
  export async function NaturalLanguageRoutine< IN, OUT >( input: IN, input_decoder: decode_function<IN>, nl: string, out_schema: string, output_encoder: encode_function<OUT>, final_instructions: string ): Promise< OUT >
  {
    let t =
  `{{{input}}}
  
  {{{nl}}}
  
  {{{out_schema}}}
  
  {{{final_instructions}}}
  `;
  
    let p = await promptTemplate( t, {input: await input_decoder(input), nl: nl, out_schema: out_schema, final_instructions: final_instructions}, 10, 250, 1 );
    let r = await output_encoder( p );
    return( r );
  }

  let cog_axios = new Cog( "axios", [], async ( session: ChatSession, args: any, message_sans_args: string ) => {
    let url = args["url"];
    if ( url.indexOf("<") == 0 )
    {
      url = url.substring(1);
      // And also remove the trailing >
      url = url.substring(0, url.length - 1);
    }
      let method = args["method"] || "get";
    let data = args["data"] || {};
    let headers = args["headers"] || {};
    let response = await wf_axios( url, method, data, headers );
    return response;
  });
  
  let cog_replicate_sd = new Cog( "replicate_sd", [], async ( session: ChatSession, args: any, message_sans_args: string ): Promise<string> => {
    let detailedPrompt = await promptTemplate(
  `{{user}} has asked you for a beautiful piece of art with the following instructions:
  
  {{{instructions}}}
  
  You are an art expert, and you are going to combine the request with your knowledge of artists and art styles to describe in great detail what this piece of art should look like, including as much detail as possible:`,
    
    {instructions: args["prompt"], user: session.user}, 20, 500, 1.0 );
  
    let results = <any> await executeWorkflow( TEMPORAL_HOST, "StableDiffusionWorkflow", "GO_TASK_QUEUE", [{"Prompt": detailedPrompt} ] );
    results[ "in_prompt" ] = args["prompt"];
    results[ "out_prompt" ] = detailedPrompt;
    return JSON.stringify( results );
  });
  
  let plan_chainprompt_cog = new Cog( "plan_chainprompt", [], async ( session: ChatSession, args: any, message_sans_args: string ): Promise<string> => {
    let plan = await Chatbot( session.personality, 5, session.personality.name, `OK, so, ${session.user} wants me to "${args["plan"]}".  I'm going to need to plan this one out into multiple steps. Let's develop a plan, step by step, and output a JSON array with the steps. | ["Step 1:`, session, false, false );
    return plan;
  });
  
  let mapreduce_summarize_cog = new Cog( "mapreduce_summarize", [], async ( session: ChatSession, args: any, message_sans_args: string ) => await mapreduce_summary( args["text"] ) );
  let noop_cog = new Cog( "noop", [], async ( session: ChatSession, args: any, message_sans_args: string ) => "" );
  
  
  let cogs = new Cogset( [cog_axios, cog_replicate_sd, plan_chainprompt_cog, mapreduce_summarize_cog, mapreduce_summarize_cog, noop_cog] );
  
  export async function IndexCog( cog: Cog )
  {
    for ( let t of cog.getTeachings() )
    {
      // Calculate md5sum of a concatenation of prompt and completion
      let sum = await md5sum( t.prompt + t.completion );
  
      await es_index( "teachings", {
        "text": t.text,
        "user": t.user,
        "prompt": t.prompt,
        "completion": t.completion,
        "prompt_leading": t.prompt_leading,
        "md5sum": sum,
      });
    }
  }
  
  async function IndexCogset( cogset: Cogset )
  {
    for ( let cog of cogset.getCogs() )
    {
      await IndexCog( cog );
    }
  }
  
  export async function DumpAndRestoreCogsetTeachings()
  {
    await init_elasticsearch_mappings();
    await IndexCogset( cogs );
  }
  
  export async function post_message_filtering( session: ChatSession ): Promise< string >
  {
    // If the last message has !x:{} in it, we are going to grab the last message and see if we can match x to a filter event handler
    let last_message = session.messages[session.messages.length - 1];
  
    // !kali_sh:{"command":"nmap 127.0.0.1"}
    let matches = last_message.response.match( /!([a-zA-Z0-9_]+):{(.*)}/ );
    if ( matches )
    {
      console.log(`We have a filter match: ${matches[1]}`);
      let filter = matches[1];
      let filter_args = matches[2];
      console.log(`Parsing filter args: ${filter_args}`);
      let filter_args_json = JSON.parse( `{${filter_args}}` );
      let filter_handler = cogs.getCog( filter );
      if ( filter_handler )
      {
        let message_sans_args = last_message.response.replace( matches[0], "" );
        let filtered_message = await filter_handler.handle( session, filter_args_json, message_sans_args );
        return filtered_message;
      }
    }
  
    console.log("No filter matching.")
    return last_message.response;
  }
  