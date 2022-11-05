import process from 'process';

export const NLPCLOUD_TOKEN = process.env.NLPCLOUD_TOKEN ?? "";
export const OPENAI_TOKEN = process.env.OPENAI_TOKEN ?? "";
export const SERP_KEY = process.env.SERP_KEY ?? "";
export const TEMPORAL_HOST = process.env.TEMPORAL_HOST ?? "";
export const GOOGLE_SERVICE_KEY = process.env.GOOGLE_SERVICE_KEY ?? "";
export const ElasticConfig = JSON.parse(process.env.ELASTIC_CONFIG ?? "{}");
