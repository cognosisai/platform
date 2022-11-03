export const NLPCLOUD_TOKEN = '';
export const OPENAI_TOKEN = '';
export const SERP_KEY = '';
export const TEMPORAL_HOST = '';
export const GOOGLE_SERVICE_KEY = {};
export const ELASTIC_KEY = '';
export const ELASTIC_CLOUD_ID = '';

/*
Example for local development:

export const ElasticConfig = { 
    auth: { username: "elastic", password: "+xldU8t-mHh_Q5m+sKyO" },
    node: "https://localhost:9201",
    tls: {
        // might be required if it's a self-signed certificate
        rejectUnauthorized: false,
    },
};
*/

/* elastic.co cloud hosted example */
export const ElasticConfig = {
    cloud: { id: ELASTIC_CLOUD_ID },
    auth: { apiKey: ELASTIC_KEY }
};

