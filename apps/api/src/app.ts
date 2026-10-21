import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import type { Db } from './db/pool.js';
import { adminMenuRouter, publicMenuRouter } from './modules/menu/routes.js';
import { adminOrdersRouter, publicOrdersRouter } from './modules/orders/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { adminTablesRouter, publicTablesRouter } from './modules/tables/routes.js';
import { shiftsRouter } from './modules/shifts/routes.js';
import { reportsRouter } from './modules/reports/routes.js';
import { settingsRouter } from './modules/settings/routes.js';
import { paymentsRouter } from './modules/payments/routes.js';
import { Hub } from './realtime/hub.js';
import { errorHandler } from './utils/http.js';

export interface AppOptions {
  db: Db;
  hub?: Hub;
  orderLimitPerMinute?: number;
  loginLimitPerMinute?: number;
}

export function createApp({ db, hub = new Hub(), orderLimitPerMinute, loginLimitPerMinute }: AppOptions) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.corsOrigin, credentials: false }));

  // Вебхук платежей читает «сырое» тело сам — регистрируем до express.json.
  const api = express.Router();
  api.use(paymentsRouter(db, hub, env.paymentProvider === 'mock'));
  api.use(express.json({ limit: '200kb' }));

  api.get('/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true });
  });
  api.use(publicMenuRouter(db));
  api.use(publicTablesRouter(db));
  api.use(publicOrdersRouter(db, hub, orderLimitPerMinute));
  api.use(authRouter(db, loginLimitPerMinute));
  api.use('/admin', adminOrdersRouter(db, hub));
  api.use('/admin', adminMenuRouter(db));
  api.use('/admin', adminTablesRouter(db));
  api.use('/admin', shiftsRouter(db));
  api.use('/admin', reportsRouter(db));
  api.use('/admin', settingsRouter(db));

  app.use('/api', api);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);
  return { app, hub };
}
