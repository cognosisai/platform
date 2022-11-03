import { Connection, WorkflowClient } from '@temporalio/client';
import {
  mapPromptTemplate,
  mapreduce_summary,
  TranscriptToStructuredData
} from './workflows';
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
    connection
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
  });

  /* Take first process.argv argument and use it as the path to the embeddings file */
  const path = process.argv[2];
  /* Take second process.argv argument and use it as the index name */
  const index = process.argv[3];

  console.log(`Indexing ${path} to ${index}`);
  /* Open file, split into lines */
  const lines = (await fs.promises.readFile(path)).toString();

  let prompt = `The following code is part of a TypeScript project that uses Temporal for workflow orchestration. It is the worker code.

{{{chunk}}}

Convert this code to Go:
`;
  const handle = await client.start(mapPromptTemplate, {
    // type inference works! args: [name: string]
    args: [lines, prompt],
    taskQueue: 'hello-world',
    // in practice, use a meaningful business id, eg customerId or transactionId
    workflowId: 'workflow-' + nanoid()
  });
  let result = await handle.result();
  console.log(result);
  // Save results to a file
  await fs.promises.writeFile(`${path}-out`, result);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
