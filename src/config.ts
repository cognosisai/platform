import process from 'process';
import * as dotenv from 'dotenv';

dotenv.config();

export const NLPCLOUD_TOKEN = process.env.NLPCLOUD_TOKEN ?? '';
export const OPENAI_TOKEN = process.env.OPENAI_TOKEN ?? '';
export const SERP_KEY = process.env.SERP_KEY ?? '';
export const TEMPORAL_HOST = process.env.TEMPORAL_HOST ?? '';
export const EMBEDDINGS_URL = process.env.EMBEDDINGS_URL ?? '';
export const ElasticConfig = JSON.parse(process.env.ELASTIC_CONFIG ?? '{}');
