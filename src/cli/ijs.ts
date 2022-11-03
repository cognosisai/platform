import { Connection, WorkflowClient } from '@temporalio/client';
import { IJavascript } from './workflows';
import { nanoid } from 'nanoid';
import fs from 'fs';

async function run() {
  // Connect to the default Server location (localhost:7233)
  //const connection = await Connection.connect();
  const connection = await Connection.connect({
    address: 'prod-cognosisai-temporal.internal:7233'
  });

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
  const handle = await client.start(IJavascript, {
    // type inference works! args: [name: string]
    args: [process.argv[2]],
    taskQueue: 'hello-world',
    // in practice, use a meaningful business id, eg customerId or transactionId
    workflowId: 'workflow-' + nanoid()
    // retry: {
    //   initialInterval: 1,
    //   backoffCoefficient: 2,
    //   maximumAttempts: 1,
    //   maximumInterval: 1,
    //   nonRetryableErrorTypes: ['CustomError'],
    // },
  });

  let result = await handle.result();
  console.log(result);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
