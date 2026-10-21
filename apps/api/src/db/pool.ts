import pg from 'pg';
import { env } from '../config/env.js';

// pg возвращает int8 как строку; наши суммы небольшие, поэтому приводим к числу.
pg.types.setTypeParser(20, (v) => parseInt(v, 10));

export type Db = pg.Pool;

export function createPool(url = env.databaseUrl): Db {
  const ssl = env.isProd && !/localhost|127\.0\.0\.1/.test(url) ? { rejectUnauthorized: false } : undefined;
  return new pg.Pool({ connectionString: url, ssl, max: 10 });
}
