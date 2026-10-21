import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import EmbeddedPostgres from 'embedded-postgres';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { migrate } from '../src/db/migrate.js';
import { createPool, type Db } from '../src/db/pool.js';
import { seedDemo } from '../src/db/seed.js';

export interface TestCtx {
  db: Db;
  http: ReturnType<typeof request>;
  stop: () => Promise<void>;
  adminToken: string;
  staffToken: string;
}

/** PostgreSQL не запускается от root: если тесты идут под root (контейнер/CI), отдаём папку пользователю postgres. */
function handOverToPostgresUser(dir: string) {
  if (process.getuid?.() !== 0) return;
  try {
    const uid = Number(execFileSync('id', ['-u', 'postgres']).toString().trim());
    const gid = Number(execFileSync('id', ['-g', 'postgres']).toString().trim());
    fs.chownSync(dir, uid, gid);
  } catch {
    /* пользователя postgres нет — пусть embedded-postgres сообщит ошибку сам */
  }
}

/** Поднимает настоящий PostgreSQL во временной папке и приложение поверх него. */
export async function startTestApp(): Promise<TestCtx> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'croissant-pg-'));
  handOverToPostgresUser(dir);
  const port = 54000 + Math.floor(Math.random() * 900);
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port, persistent: false });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('test');
  const db = createPool(`postgres://postgres:postgres@localhost:${port}/test`);
  await migrate(db);
  await seedDemo(db);
  for (const [u, role] of [['admin', 'admin'], ['staff', 'staff']] as const) {
    await db.query('INSERT INTO users(username,password_hash,role) VALUES ($1,$2,$3)', [u, await bcrypt.hash('password123', 4), role]);
  }
  // В тестах время работы не должно мешать.
  await db.query(`INSERT INTO settings(key,value) VALUES ('hours','{"enabled":false}'::jsonb)`);
  const { app } = createApp({ db, orderLimitPerMinute: 1000, loginLimitPerMinute: 1000 });
  const http = request(app);
  const login = async (username: string) => (await http.post('/api/auth/login').send({ username, password: 'password123' })).body.token as string;
  return {
    db,
    http,
    adminToken: await login('admin'),
    staffToken: await login('staff'),
    stop: async () => {
      await db.end();
      await pg.stop();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
