# Cognosis AI Platform

## Summary

The Cognosis AI Platform contains an application server and all of the
infrastructure you need to build Large Language Model applications with,
batteries included!

## Quickstart

Requirements:

  * Docker
  * Node 19

### Step 1: Get Infrastructure Running

  # Clone the repo and cd into it
  git clone git@github.com:cognosisai/platform.git
  cd platform
  
  # On Apple M1/M2 chips:
  make build-apple
  # On x86:
  make build-x86
  
  # Spin it all up! This runs docker-compose up, and will get you
  # Elasticsearch 8.5, cognosis-embeddings service, and temporalite, which
  # is a single Docker container version of Temporal meant for development
  make run

### Step 2: Configure 
Edit .env, and populate it with the following information:

  TEMPORAL_HOST="localhost:7233"
  ELASTIC_CONFIG={"auth":{"username":"elastic","password":"changeme"},"node":"http://localhost:9200"}
  OPENAI_TOKEN="<OpenAI Token>"
  NLPCLOUD_TOKEN="<NLP Cloud Token>"
  EMBEDDINGS_URL="http://localhost:9100"

### Step 3: Install NPM modules

  npm install

## Step 4: Start Temporal Worker

  ts-node src/worker.ts

This will take a few seconds. It will be ready when you see this:

  2022-11-05T23:51:17.087Z [INFO] webpack 5.74.0 compiled successfully in 717 ms
  2022-11-05T23:51:17.093Z [INFO] Workflow bundle created { size: '0.91MB' }
  2022-11-05T23:51:17.141Z [INFO] Worker state changed { state: 'RUNNING' }

## Step 5: AI!

  ts-node src/cli/cognosis.ts "Give me a really terrible idea involving an \
  icepick, and bottle of elmer's wood glue"
  Starting wfid workflow-fC-ONstofj4T4G9C_JQv5
  
  Use the icepick to make a hole in the bottle of glue, then drink it.

### Application Server Components

#### Elastic Search
#### Temporal
#### Embeddings (Tensorflow - Google USE5)
#### Cognosis AI SDK

### Cognosis AI SDK

Cognosis AI Platform includes 
