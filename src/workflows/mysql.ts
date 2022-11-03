import * as mysql from '../activities/mysql';
import * as prompt from './prompt';

import { proxyActivities, uuid4 } from '@temporalio/workflow';

const { dbquery } = proxyActivities<typeof mysql>({
  startToCloseTimeout: '10 minute'
});

const {
  promptReducer,
  promptTemplate,
  splitPromptTemplateByLinesOfTokens,
  splitPromptTemplateByTokens
} = proxyActivities<typeof prompt>({ startToCloseTimeout: '10 minute' });

/**
 * @function mysqlQuery
 * @param {string} dbhost
 * @param {string} dbuser
 * @param {string} dbpassword
 * @param {string} dbname
 * @param {string} sql
 * @param {Array<any>} parameters
 * @description A workflow that simply calls an activity
 */
export async function mysqlQuery<T>(
  dbhost: string,
  dbuser: string,
  dbpassword: string,
  dbname: string,
  sql: string,
  parameters: Array<any>
): Promise<Array<T>> {
  return await dbquery(dbhost, dbuser, dbpassword, dbname, sql, parameters);
}

/**
 * @function xNLPonDB
 * @param {string} query - The natural language query to parse.
 * @returns {Promise<any>} - The results of the SQL query.
 * @description Takes a natural language query and translates it into SQL.
 */
export async function xNLPonDB(
  host: string,
  username: string,
  password: string,
  dbname: string,
  query: string
): Promise<any> {
  /* We start out by getting the table schema. */
  /* TODO: This should be cached. */
  interface tableschema {
    TABLE_NAME: string;
    COLUMN_NAME: string;
  }

  let results: tableschema[] = await mysqlQuery(
    host,
    username,
    password,
    dbname,
    'SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA = ?',
    [dbname]
  );
  let tables: Map<string, boolean> = new Map<string, boolean>();

  /* Next, we come up with a list of tables, and we ask it to identify the tables that it needs the schema for this query. */
  results.map((table_column) => {
    tables.set(table_column.TABLE_NAME, true);
  });

  let tablenames = Array.from(tables.keys());
  let tablesColumns = new Map<string, Array<string>>();

  /* Now, we get the schema for each table. */
  for (let table of tablenames) {
    tablesColumns.set(table, new Array<string>());
  }

  results.map((table_column) => {
    tablesColumns.get(table_column.TABLE_NAME)!.push(table_column.COLUMN_NAME);
  });

  let prompt = `SHOW TABLES;
 {{#tablenames}}
 {{{.}}}
 {{/tablenames}}
 
 For the natural language query "{{{query}}}", generate a comma-separated list of tables should we search, only from the above tables:`;
  let r = await promptTemplate(
    prompt,
    { tablenames: tablenames, query: query },
    10,
    50,
    1.0
  );
  let relevant_tables = r.split(/\s?,/);
  prompt = 'Here are the tables you have available:';
  for (let table of relevant_tables) {
    table = table.trim();
    table = table.replace(/^\n+/, '').replace(/\n+$/, '').toLowerCase();
    if (tablesColumns.get(table)) {
      prompt += `CREATE TABLE ${table} (`;
      prompt += tablesColumns.get(table)!.join(',');
      prompt += ');\n';
    }
  }
  prompt +=
    '\n/* Using only the above tables, a single SQL query for "{{{query}}}": */ SELECT';
  r =
    'SELECT ' + (await promptTemplate(prompt, { query: query }, 10, 300, 1.0));

  let result2 = await mysqlQuery(host, username, password, dbname, r, []);
  return r + '\n\n' + JSON.stringify(result2);
}

export async function NLPonDB(query: string): Promise<any> {
  try {
    return await xNLPonDB(query, 'xx', 'yy', 'zz', '11');
  } catch (e: any) {
    return e.toString();
  }
}
