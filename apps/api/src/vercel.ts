// Точка входа для Vercel (бессерверная функция). Собирается в api/index.mjs командой
// `npm run build:vercel-api`. Миграции и сиды здесь не запускаются: база уже подготовлена,
// новые миграции применяйте командой `DATABASE_URL=... npm run migrate`.
import { createApp } from './app.js';
import { createPool } from './db/pool.js';
import { errorHandler } from './utils/http.js';

const db = createPool(undefined, 3);
const { app } = createApp({ db });
app.use(errorHandler);

export default app;
