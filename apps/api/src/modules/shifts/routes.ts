import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { HttpError, parse } from '../../utils/http.js';

const openSchema = z.object({ opening_cash: z.number().int().min(0).default(0) });
const closeSchema = z.object({ closing_cash: z.number().int().min(0), note: z.string().max(300).default('') });
const entrySchema = z.object({ kind: z.enum(['in', 'out']), amount: z.number().int().min(1), note: z.string().max(200).default('') });

/** Наличные в кассе = старт + наличные заказы (оплачено) + внесения − изъятия. */
async function summarize(db: Db, shiftId: number) {
  const shift = (await db.query('SELECT * FROM shifts WHERE id = $1', [shiftId])).rows[0];
  const sales = (
    await db.query(
      `SELECT payment_method, COALESCE(SUM(total),0)::int AS sum, COUNT(*)::int AS count
       FROM orders WHERE shift_id = $1 AND status <> 'cancelled' GROUP BY payment_method`,
      [shiftId],
    )
  ).rows;
  const cashSales = (
    await db.query(
      `SELECT COALESCE(SUM(total),0)::int AS sum FROM orders
       WHERE shift_id = $1 AND status <> 'cancelled' AND payment_method = 'cash' AND payment_status = 'paid'`,
      [shiftId],
    )
  ).rows[0].sum as number;
  const entries = (await db.query('SELECT * FROM cash_entries WHERE shift_id = $1 ORDER BY id', [shiftId])).rows;
  const cashIn = entries.filter((e) => e.kind === 'in').reduce((s, e) => s + e.amount, 0);
  const cashOut = entries.filter((e) => e.kind === 'out').reduce((s, e) => s + e.amount, 0);
  return {
    shift,
    sales,
    total_sales: sales.reduce((s, x) => s + x.sum, 0),
    orders_count: sales.reduce((s, x) => s + x.count, 0),
    cash_entries: entries,
    expected_cash: shift.opening_cash + cashSales + cashIn - cashOut,
  };
}

export function shiftsRouter(db: Db) {
  const r = Router();
  r.use('/shifts', requireAuth());

  r.get('/shifts/current', async (_req, res) => {
    const s = (await db.query('SELECT id FROM shifts WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1')).rows[0];
    res.json(s ? await summarize(db, s.id) : null);
  });

  r.get('/shifts', async (_req, res) => {
    res.json((await db.query('SELECT * FROM shifts ORDER BY id DESC LIMIT 60')).rows);
  });

  r.post('/shifts/open', async (req, res) => {
    const b = parse(openSchema, req.body ?? {});
    const existing = (await db.query('SELECT id FROM shifts WHERE closed_at IS NULL LIMIT 1')).rows[0];
    if (existing) throw new HttpError(409, 'A shift is already open', 'shift_open');
    const row = (await db.query('INSERT INTO shifts(opened_by, opening_cash) VALUES ($1,$2) RETURNING id', [req.user!.id, b.opening_cash])).rows[0];
    res.status(201).json(await summarize(db, row.id));
  });

  r.post('/shifts/close', async (req, res) => {
    const b = parse(closeSchema, req.body);
    const s = (await db.query('SELECT id FROM shifts WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1')).rows[0];
    if (!s) throw new HttpError(409, 'No open shift', 'no_shift');
    const sum = await summarize(db, s.id);
    await db.query('UPDATE shifts SET closed_at = now(), closing_cash = $1, expected_cash = $2, note = $3 WHERE id = $4', [
      b.closing_cash,
      sum.expected_cash,
      b.note,
      s.id,
    ]);
    const closed = await summarize(db, s.id);
    res.json({ ...closed, difference: b.closing_cash - sum.expected_cash });
  });

  r.post('/shifts/cash', async (req, res) => {
    const b = parse(entrySchema, req.body);
    const s = (await db.query('SELECT id FROM shifts WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1')).rows[0];
    if (!s) throw new HttpError(409, 'No open shift', 'no_shift');
    await db.query('INSERT INTO cash_entries(shift_id, kind, amount, note) VALUES ($1,$2,$3,$4)', [s.id, b.kind, b.amount, b.note]);
    res.status(201).json(await summarize(db, s.id));
  });
  return r;
}
