import {executeWorkflow, executeLocalWorkflow} from '../util';
import {generateText, generateTextOpenAI, retryGenerateTextOpenAI} from '../llm';
import axios from 'axios';
import { spawn } from 'child_process';
import fs from 'fs';

import {TEMPORAL_HOST} from '../../config';

export function searchLoadedPackages(): [string, string][]
{
  return [
    ["x.http",          "perform HTTP requests"],
  //  ["x.mysql",     "MySQL client"],
    ["x.google",        "Google APIs"],
    ["x.nlp",           "Natural Language Processing"],
   // ["x.illustrations", "Illustrations"],
  ];
}

export function inspectLoadedPackage( name: string ): string[]
{
  let package_methods = new Map< string, string[] >();
  package_methods.set( "x.google",
    [
      "async function search(query:string): Promise< {rank: number, url: string, title: string, description: string}[] >",
    ]);
  package_methods.set( "x.http",
    [
      "async function x.http.get(url: string): Promise< {status: number, statusText: string, content: any} >",
      "async function x.http.post(url: string, data: any): Promise< string >",
      "async function x.http.put(url: string, data: any): Promise< string >",
      "async function x.http.delete(url: string): Promise< string >",
    ]);
 /* package_methods.set( "mysql",
    [
      "async function query(query: string): Promise< any >",
    ]);*/
  
  package_methods.set( "x.nlp",
    [
      "async function x.nlp.summarize(text: string): Promise< string >",
      "async function x.nlp.question_answer(text: string, question: string): Promise< string >",
      "async function x.nlp.ai_instruction_on_text( text: string, instructions: string ): Promise< string >",
    ]);

  package_methods.set( "x.illustrations",
    [
      "async function x.illustrations.get_illustration( description: string ): Promise< string >",
    ]);

  return package_methods.get( name ) || [];
}

import repl from 'node:repl';
import net from 'node:net';
import Semaphore from 'semaphore-async-await';

net.createServer((socket: any ) => {
  repl.start({
    prompt: '28dc9e0c ',
    input: socket,
    output: socket,

    writer: (output: any) => {
      return JSON.stringify(output);
    },

  }).on('exit', () => {
    socket.end();
  });
}).listen(5001);


/* Class which wraps net.connect, sockets with promises */
class Socket
{
  private socket: net.Socket;
  private lock: Semaphore;

  constructor( port: number, host: string )
  {
    this.socket = net.connect( port, host );
    this.lock = new Semaphore( 1 );
  }

  public async write( data: string ): Promise< void >
  {
    return new Promise( (resolve, reject) => {
      this.socket.write( data, () => {
        resolve();
      });
    });
  }

  public async read(): Promise< string >
  {
    return new Promise( (resolve, reject) => {
      this.socket.once('data', (data: any) => {
        resolve( data.toString() );
      });
    });
  }

  public async close(): Promise< void >
  {
    return new Promise( (resolve, reject) => {
      this.socket.end( () => {
        resolve();
      });
    });
  }

  public async writeAndRead( data: string ): Promise< string >
  {
    console.log(`Acquiring lock for command ${data}`);
    await this.lock.acquire();
    console.log( `Lock acquired for command ${data}` );
    let retval = new Promise< string >( ( resolve, reject ) =>
    {
      this.socket.once( 'data', ( data ) => resolve( data.toString() ) );
    } );

    await this.write( data );
    console.log( `Wrote command ${data}` );
    let response = await retval;
    console.log( `Read response ${response}` );
    this.lock.release();
    console.log( `Released lock for command ${data}` );

    /* .break() is a special command which causes the REPL to exit. We're gonna use this if we find this at the beginning: "... ..."
    */
    if( response.startsWith( '... ...' ) )
    {
      console.log( `Breaking REPL` );
      await this.writeAndRead( '.break' );
      return "ERROR: Incomplete javascript statement sent. Cancelled."
    }

    return response;
  }
}

export const google = {
  search: async function( query: string ): Promise< string[] >
  {
    console.log( `Searching for ${query}` );
    let results = await executeWorkflow( TEMPORAL_HOST, "GoogleSearchWorkflow", "GO_TASK_QUEUE", [query] );
    console.log( `Results: ${results}` );
    return <any> results;
  }
};

export const http = {
  get: async function( url: string ): Promise< {status: number, statusText: string, content: any} >
  {
    console.log( `http.get: ${url}` );
    try
    {
    let r = await axios.get( url );
    if ( r.status != 200 )
    {
      return {status: r.status, statusText: r.statusText, content: null};
    }
    console.log( `http.get: ${url}  Status: ${r.status}` );
    // Is this JSON? We probably just want to return it, and worry about summarizing it later.
    if ( r.headers['content-type'].startsWith('application/json') )
    {
      // Is r.data a string? If so, parse it.
      if ( typeof r.data == 'string' )
        r.data = JSON.parse( r.data );
      return {status: r.status, statusText: r.statusText, content: r.data};
    }
    // Is this HTML? We probably want to summarize it.
    if ( r.data.length >= 1024 && r.headers['content-type'].startsWith('text/html') )
    {
      // Call out to pandoc to convert the HTML to plain
      let pandoc = spawn('/usr/bin/pandoc', ['-f', 'html', '-t', 'plain'], { stdio: ['pipe', 'pipe', 'pipe'] });
      pandoc.stdin.write( r.data );
      pandoc.stdin.end();
      let text = await new Promise( (resolve, reject) => {
      pandoc.stdout.on('data', async (data: any) => {
        let text = data.toString();
        console.log( `Pandoc Text length: ${text.length}` );
        resolve( text );
        } )
      } );
      return {status: r.status, statusText: r.statusText, content: text};
    }
    return {status: r.status, statusText: r.statusText, content: r.data};
    }
      catch (e: any)
      {
        console.log( `http.get: ${url}  Error: ${e}` );
        return {status: 500, statusText: e, content: null};
      }
  }
};

export const nlp = {
  summarize: async function( text: string ): Promise< string >
  {
    if ( text == null || text.length == 0 || text == undefined )
    {
      return "ERROR: <Text is null or empty.>";
    }
    // if type of the text is actually an object, we should also return an error
    if ( typeof text == 'object' )
    {
      return "ERROR: <Text is an object.>";
    }
    console.log(`Summarizing: ${text}`);
    let r = await executeLocalWorkflow( "mapreduce_summary", "hello-world", [text] );
    console.log( `Result: ${r}` );
    return <string> r;
  },
  question_answer: async function( text: string, question: string ): Promise< string >
  {
    console.log(`Summarizing: ${text}`);
    let r = await executeLocalWorkflow( "mapreduce_question_text", "hello-world", [text, question] );
    console.log( `Result: ${r}` );
    return <string> r;
  },
  ai_instruction_on_text: async function( text: string, instructions: string ): Promise< string >
  {
    console.log(`ai_instruction: ${text}`);
    let r = <any> await executeLocalWorkflow( "mapPromptTemplate", "hello-world", [text, `{{{chunk}}}\n${instructions}:\n` ] );
    let r2 = r.join( "\n" );
    console.log( `Result: ${r2}` );
    return <string> r2;
  },
};


export const illustrations = {
  get_illustration: async function( description: string ): Promise< string >
  {
    console.log(`Getting illustration for ${description}`);
    let r = await executeWorkflow( TEMPORAL_HOST, "StableDiffusionWorkflow", "GO_TASK_QUEUE", [{"Prompt": description}] );
    console.log( `Result: ${r}` );
    return <string> r;
  }
}


/**
 * Execute javascript code in a sandbox with prompt chaining in notebook format
 * @param p 
 * @param apiKey 
 */
export async function executeJavascriptNotebook( p: string, apiKey: string ): Promise< string >
{
  console.log( `Executing Javascript Notebook: ${p}` );

  let notebook = fs.readFileSync( './src/prompts/notebook-template.txt', 'utf8' );
  notebook += p;
  // Template includes a variable called {{{todaysdate}}} which we want to replace with something like October 16, 2022
  notebook = notebook.replace( '{{{todaysdate}}}', new Date().toLocaleDateString( 'en-US', { month: 'long', day: 'numeric', year: 'numeric' } ) );
  // if p does not have a newline at the end, we're going to add it to notebook
  if( p[p.length-1] != '\n' )
  {
    notebook += '\n';
  }

  // Execute OpenAI API call using code model
  let r = await retryGenerateTextOpenAI( notebook, apiKey, 10, 1024, 0.0, 0.99, "code-davinci-002", ["Question:", "Out[", "Out ["] );
  let orig_completion = r;
  if( orig_completion.indexOf( "Answer:" ) != -1 )
  {
    // Yes, so we need to execute the answer
    let answer = orig_completion.substring( orig_completion.indexOf( "Answer:" ));
    return( answer );
  }

  
  // This will probably return a string that looks like this:
  // "IJavascript session:\n```\nIn [1]: searchLoadedPackages()\n"
  // Chop off the "IJavascript session:\n```\nIn [1]: " part so we are left with nothing but the javascript part
  let js = r.substring( r.indexOf( "In [1" ) + 8 );

  // Now we will execute the javascript using nodejs vm module:
  try
  {
    // Connect a socket to localhost:5001
    let socket = new Socket( 5001, 'localhost' );
    // First, we import the packages we need
    await socket.writeAndRead( "const x = require('./src/activities')\n" );
    await socket.writeAndRead( "console.log = function(x) { return x }\n" );

    return await executeJavascriptSnippetLoop( notebook, apiKey, socket, 1, p );

    /*
    This is all bad.

    // Write the javascript to the socket
    let ret = await socket.writeAndRead( js );
    // Remove anything after 28dc9e0c in the string ret
    ret = ret.substring( 0, ret.indexOf( "28dc9e0c" ) );

    console.log( `Javascript returned: ${ret}` );
    let retraw = parse( ret );

     // Append the output to the notebook
    notebook += orig_completion;
    notebook += "Out [1] " + ret;
    notebook += '\n'; 
    return await executeJavascriptSnippetLoop( notebook, apiKey, socket, 2 );
    */
  }
  catch( e: any )
  {
    return( js + "\n\nError: " + e );
  }
}


async function executeJavascriptSnippetLoop( n: string, apiKey: string, socket: Socket, counter: number, original_question: string ): Promise< string >
{
  console.log( `Executing Javascript Snippet count ${counter}` )

  if ( counter > 100 )
  {
    return `>> ERRROR.  Too many loops (${counter}).  Aborting.`;
  }

  // Print the last 3 lines of n
  let lines = n.split( /\r?\n/ );
  let last3 = lines.slice( Math.max( lines.length - 3, 0 ) ).join( '\n' );
  console.log( last3 );

  let next_in_stop = `In [${counter + 1}]`;
  let next_out_stop = `Out[`;
  let error_in_stop = `Error [${counter + 1}]`;

  let r = await retryGenerateTextOpenAI( n, apiKey, 10, 512, 0.0, 1, "text-davinci-002", ["Question:", "Out [", error_in_stop, next_in_stop] );
  let origr = r;
  console.log( origr );

  if ( origr.indexOf(next_out_stop) != -1 )
  {
    // Delete this value and everything else after it
    r = r.substring( 0, r.indexOf( next_out_stop ) );
    origr = r;
  }

  if( origr.indexOf( "Answer:" ) != -1 )
  {
    console.log("Answer found");
    try
    {
      console.log("Going to wait for the last value to be returned");
      let lastret = await socket.writeAndRead( "JSON.stringify(_)\n" );
      let answer = origr + "\n" + lastret;
      console.log(answer);

      console.log("Ask it to summarize the whole thing.");
      let summary_prompt_append = "\n\nTake everything you've seen so far, and summarize it in a way that may be useful later:";
      let r2 = await retryGenerateTextOpenAI( n + summary_prompt_append, apiKey, 10, 512, 0.0, 1, "text-davinci-002" );
      console.log( r2 );
      return answer + "\n\n" + r2;

      // console.log("Good bye!");
      // return( answer );
    }
    catch( e: any )
    {
      console.log(`Strange. We got an answer but we couldn't get the last return value: ${e}`);
      return( origr );
    }
  }

  let js = r.substring( r.indexOf( `In [${counter}` ) + 8 );
  // Trim off any leading newlines
  js = js.replace( /^\s+/, '' );
  // Trim off any trailing newlines
  js = js.replace( /\s+$/, '' );
  js = js.trim();
  js = js + "\n";
  // Remove all of the ...:
  js = js.replace( /\.\.\.\:\s+/g, '' );

  try
  {
    console.log( `Javascript: "${js}"` );
    let processedOut = await socket.writeAndRead( js );
    console.log(`Raw ret: <<<${processedOut}>>>\n\n=======\n`);
    processedOut = processedOut.substring( 0, processedOut.indexOf( "28dc9e0c" ) );
    if ( processedOut.indexOf("Uncaught") != -1 )
    {
      console.log(`Uncaught error found.  Trying to figure out what it is.`);
      n += `In [${counter}] ${js}\n`;
      let errmsg = await socket.writeAndRead( `_error.message\n` );
      console.log(`** REAL Error message: ${errmsg}`);
      n += `Error [${counter}]: ${errmsg}\n`;
      return await executeJavascriptSnippetLoop( n, apiKey, socket, counter + 1, original_question );
    }

    // If output is longer than 80 characters, truncate, and add dots
    if( processedOut.length > 512 )
    {
      console.log("Truncating.")
      processedOut = processedOut.substring( 0, 512 ) + `... Output truncated. Full output is in the 'return_${counter}' variable.`;
      console.log("Truncated and set lastreturn.")
    }

    // Append the output to the notebook
    let varname = `return_${counter}`;
    console.log(`We are writing to variable ${varname}`);
    await socket.writeAndRead( `var ${varname} = _;\n` );
    n += origr;
    n += `Out [${counter}] ${varname} = ` + processedOut;
    n += "\n";
    // n += "/* This is where we will";
    if ( counter % 3 == 0 )
    {
      n += `/* Remembering our original goal: ${original_question} */\n`;
    }
    console.log( `Out [${counter}] ${varname} = ` + processedOut );

    if ( js.startsWith("console.log") )
    {
      console.log("console.log detected. Not going to execute the next line.");
      return processedOut;
    }

    return executeJavascriptSnippetLoop( n, apiKey, socket, counter + 1, original_question );
  }
  catch( e: any )
  {
    n += `Error [${counter}] ` + e;
    console.log(`Error: ${e} while trying to execute ${js}`);
    //return executeJavascriptSnippetLoop( n, apiKey, context, counter ++ );
    return `Error: ${e} while trying to execute ${js}\n`;
  }
}
