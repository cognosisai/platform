import axios from 'axios';
import * as util from '../activities/util';
import { proxyActivities, uuid4 } from '@temporalio/workflow';

const { nlp_stable_diffusion, actionLogger, md5sum, wf_axios } =
  proxyActivities<typeof util>({ startToCloseTimeout: '10 minute' });

export async function stable_diffusion(prompt: string): Promise<string> {
  return await nlp_stable_diffusion(prompt);
}

export async function logger(msg: string) {
  await actionLogger(msg);
}
