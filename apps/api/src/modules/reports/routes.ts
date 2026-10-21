import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { parse } from '../../utils/http.js';

const TZ = 'Asia/Qyzylorda';
const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

async function build(db: Db, from: string, to: string) {
  // Отменённые заказы в выручку не входят.
  const base = `FROM orders o WHERE o.status <> 'cancelled'
    AND (o.created_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date`;
  const p = [from, to, TZ];
  const totals = (
    await db.query(`SELECT COALESCE(SUM(o.total),0)::int AS revenue, COUNT(*)::int AS orders,
      COALESCE(ROUND(AVG(o.total)),0)::int AS avg_check ${base}`, p)
  ).rows[0];
  const byDay = (
    await db.query(`SELECT to_char((o.created_at AT TIME ZONE $3)::date,'YYYY-MM-DD') AS day,
      SUM(o.total)::int AS revenue, COUNT(*)::int AS orders ${base} GROUP BY 1 ORDER BY 1`, p)
  ).rows;
  const byType = (
    await db.query(`SELECT o.type, SUM(o.total)::int AS revenue, COUNT(*)::int AS orders ${base} GROUP BY o.type ORDER BY revenue DESC`, p)
  ).rows;
  const byPayment = (
    await db.query(`SELECT o.payment_method, SUM(o.total)::int AS revenue, COUNT(*)::int AS orders ${base} GROUP BY o.payment_method ORDER BY revenue DESC`, p)
  ).rows;
  const topItems = (
    await db.query(
      `SELECT i.name, SUM(i.qty)::int AS qty, SUM(i.qty * i.unit_price)::int AS revenue
       FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.status <> 'cancelled' AND (o.created_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
       GROUP BY i.name ORDER BY qty DESC, revenue DESC LIMIT 10`,
      p,
    )
  ).rows;
  return { from, to, ...totals, by_day: byDay, by_type: byType, by_payment: byPayment, top_items: topItems };
}

export function reportsRouter(db: Db) {
  const r = Router();
  r.use('/reports', requireAuth(['admin']));

  r.get('/reports', async (req, res) => {
    const q = parse(rangeSchema, req.query);
    const to = q.to ?? today();
    const from = q.from ?? to;
    res.json(await build(db, from, to));
  });

  r.get('/reports/export.csv', async (req, res) => {
    const q = parse(rangeSchema, req.query);
    const to = q.to ?? today();
    const from = q.from ?? to;
    const rows = (
      await db.query(
        `SELECT o.number, to_char(o.created_at AT TIME ZONE $3,'YYYY-MM-DD HH24:MI') AS created, o.type, o.status,
           o.payment_method, o.payment_status, o.subtotal, o.delivery_fee, o.total
         FROM orders o WHERE (o.created_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date ORDER BY o.created_at`,
        [from, to, TZ],
      )
    ).rows;
    const head = ['number', 'created', 'type', 'status', 'payment_method', 'payment_status', 'subtotal', 'delivery_fee', 'total'];
    const csv = [head.join(','), ...rows.map((row) => head.map((h) => JSON.stringify(row[h] ?? '')).join(','))].join('\n');
    res.type('text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="orders_${from}_${to}.csv"`).send('﻿' + csv);
  });
  return r;
}
