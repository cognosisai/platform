import * as ijavascript from '../../activities/application/ijavascript';
import { proxyActivities, uuid4 } from '@temporalio/workflow';

const { executeJavascriptNotebook } = proxyActivities<typeof ijavascript>({
  startToCloseTimeout: '10 minute'
});

/**
 * GPT-3 can use a IPython/Jupyter notebook "memetic proxy" to follow instructions while writing code to solve a problem. This is a workflow that uses the memetic proxy to solve a problem, as described passed as a string.
 * @param query Instructions to follow which GPT-3 will try to use a Javascript Notebook to compose a solution
 * @example
 * const result = await executeJavascriptNotebook('The number of legs a spider has multiplied by the estimated population in France');
 * @returns 
 */
export async function IJavascript(query: string): Promise<string> {
  let result = executeJavascriptNotebook(query);
  return result;
}
