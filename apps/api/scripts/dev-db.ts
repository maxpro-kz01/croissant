/**
 * Локальная PostgreSQL для разработки без установки (пакет embedded-postgres).
 * Запуск: npm run dev:db  → база на порту 5433, данные в apps/api/.pgdata
 * В продакшене используется обычный PostgreSQL (DATABASE_URL), этот скрипт там не нужен.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const dir = path.resolve(process.cwd(), '.pgdata');
const fresh = !fs.existsSync(path.join(dir, 'PG_VERSION'));

// PostgreSQL не запускается от root (контейнер/CI): отдаём папку пользователю postgres.
if (process.getuid?.() === 0) {
  fs.mkdirSync(dir, { recursive: true });
  try {
    const id = (flag: string) => Number(execFileSync('id', [flag, 'postgres']).toString().trim());
    fs.chownSync(dir, id('-u'), id('-g'));
  } catch {
    /* пользователя postgres нет — embedded-postgres сообщит ошибку сам */
  }
}

const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port: 5433, persistent: true });
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('croissant');
console.log('PostgreSQL ready: postgres://postgres:postgres@localhost:5433/croissant');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
