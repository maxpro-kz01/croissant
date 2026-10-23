import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { migrate } from './db/migrate.js';
import { createPool } from './db/pool.js';
import { seedAdmin, seedCroissant, syncMenuImages } from './db/seed.js';
import { errorHandler } from './utils/http.js';

const db = createPool();
await migrate(db);
await seedAdmin(db);
if (process.env.SEED_MENU !== '0') await seedCroissant(db); // только если меню пусто
await syncMenuImages(db);

const { app } = createApp({ db });

// Один сервис: если собран фронтенд (apps/web/dist) — отдаём его же (удобно для Render/VPS).
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}
app.use(errorHandler);

const server = app.listen(env.port, () => console.log(`API listening on :${env.port}`));

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    server.close(() => db.end().finally(() => process.exit(0)));
  });
}
