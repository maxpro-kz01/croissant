import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, type Db } from './pool.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function migrate(db: Db): Promise<string[]> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  );
  const applied = new Set((await db.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      ran.push(file);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  return ran;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const db = createPool();
  migrate(db)
    .then((ran) => console.log(ran.length ? `Applied: ${ran.join(', ')}` : 'Database is up to date'))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => db.end());
}
