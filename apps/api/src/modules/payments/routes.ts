import express, { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/pool.js';
import type { Hub } from '../../realtime/hub.js';
import { HttpError, parse } from '../../utils/http.js';
import { verifyWebhookSignature } from '../../services/payments.js';

const hookSchema = z.object({ external_id: z.string().min(1), status: z.enum(['paid', 'failed']) });

async function applyPayment(db: Db, hub: Hub, externalId: string, status: 'paid' | 'failed') {
  const pay = (await db.query('SELECT * FROM payments WHERE external_id = $1', [externalId])).rows[0];
  if (!pay) throw new HttpError(404, 'Payment not found');
  await db.query('UPDATE payments SET status = $1 WHERE id = $2', [status, pay.id]);
  const order = (
    await db.query(`UPDATE orders SET payment_status = $1, updated_at = now() WHERE id = $2 RETURNING id, number, payment_status`, [status, pay.order_id])
  ).rows[0];
  hub.emit('order.updated', order);
  return order;
}

export function paymentsRouter(db: Db, hub: Hub, allowMock: boolean) {
  const r = Router();

  /** Вебхук провайдера. Тело читаем «как есть» для проверки HMAC-подписи в заголовке x-signature. */
  r.post('/payments/webhook', express.text({ type: '*/*' }), async (req, res) => {
    const raw = typeof req.body === 'string' ? req.body : '';
    if (!verifyWebhookSignature(raw, req.header('x-signature'))) throw new HttpError(401, 'Bad signature');
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new HttpError(400, 'Bad JSON');
    }
    const b = parse(hookSchema, json);
    res.json(await applyPayment(db, hub, b.external_id, b.status));
  });

  /** Демо-оплата (только провайдер mock): имитирует успешный платёж без банка. */
  if (allowMock) {
    r.post('/payments/mock/:externalId/confirm', async (req, res) => {
      if (!req.params.externalId.startsWith('mock_')) throw new HttpError(400, 'Not a mock payment');
      res.json(await applyPayment(db, hub, req.params.externalId, 'paid'));
    });
  }
  return r;
}
