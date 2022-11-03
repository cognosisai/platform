import { default as mysql } from 'mysql2/promise';

/**
 * @param {string} dbhost
 * @param {string} dbuser
 * @param {string} dbpassword
 * @param {string} dbname
 * @param {string} sql
 * @param {Array<any>} parameters
 * @returns {Promise<Array<any>>}
 */
export async function dbquery<T>(
  dbhost: string,
  dbuser: string,
  dbpassword: string,
  dbname: string,
  sql: string,
  parameters: Array<any>
): Promise<Array<any>> {
  const connection = await mysql.createConnection({
    host: dbhost,
    user: dbuser,
    password: dbpassword,
    database: dbname
  });
  let rows: any, fields: any;
  [rows, fields] = await connection.execute(sql, parameters);
  connection.end();
  return rows;
}
