import { Connection, WorkflowClient } from '@temporalio/client';
import { esMappings, storeEmbeddings } from './workflows';
import { nanoid } from 'nanoid';
import fs from 'fs';

async function run() {
  // Connect to the default Server location (localhost:7233)
  const connection = await Connection.connect();
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new WorkflowClient({
    connection,
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
  });

  /* Take first process.argv argument and use it as the path to the embeddings file */
  const path = process.argv[2];
  /* Take second process.argv argument and use it as the index name */
  const index = process.argv[3];

  console.log( `Indexing ${path} to ${index}` );
  /* Open file, split into lines */
  const lines = (await fs.promises.readFile(path)).toString().split("\n");

  let results = new Array< Promise<any> >();

  let all_lines: string[] = [];
  let all_docs: any[] = [];
  // For each line, generate a workflow to store the embedding
  for (let i = 0; i < lines.length; i++) {
    all_lines.push( lines[i] );
    all_docs.push( {path: path, line: i+1, text: lines[i]})
  }

  const handle = await client.start(storeEmbeddings, {
    // type inference works! args: [name: string]
    args: [all_lines, index, all_docs],
    taskQueue: "hello-world",
    // in practice, use a meaningful business id, eg customerId or transactionId
    workflowId: "workflow-" + nanoid(),
  });

  results.push( handle.result() );
  await Promise.all( results );
  console.log( `Indexed ${lines.length} lines` );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
