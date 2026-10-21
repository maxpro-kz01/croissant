import { Router } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { env } from '../../config/env.js';
import type { Db } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { HttpError, parse, randomId } from '../../utils/http.js';

const tableSchema = z.object({ number: z.number().int().min(1).max(999), label: z.string().max(40).default('') });

export const tableLink = (code: string) => `${env.publicUrl.replace(/\/$/, '')}/?t=${code}`;

export function publicTablesRouter(db: Db) {
  const r = Router();
  /** Проверка кода стола из QR: возвращает номер стола, чтобы показать «Стол N». */
  r.get('/tables/:code', async (req, res) => {
    const t = (await db.query('SELECT number, label FROM tables WHERE code = $1', [req.params.code])).rows[0];
    if (!t) throw new HttpError(404, 'Unknown table', 'table_unknown');
    res.json(t);
  });
  return r;
}

export function adminTablesRouter(db: Db) {
  const r = Router();
  r.use('/tables', requireAuth(['admin']));

  r.get('/tables', async (_req, res) => {
    const rows = (await db.query('SELECT * FROM tables ORDER BY number')).rows;
    res.json(rows.map((t) => ({ ...t, link: tableLink(t.code) })));
  });
  r.post('/tables', async (req, res) => {
    const b = parse(tableSchema, req.body);
    try {
      const row = (
        await db.query('INSERT INTO tables(number,label,code) VALUES ($1,$2,$3) RETURNING *', [b.number, b.label, randomId(8)])
      ).rows[0];
      res.status(201).json({ ...row, link: tableLink(row.code) });
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new HttpError(409, 'Table number already exists', 'duplicate');
      throw e;
    }
  });
  r.delete('/tables/:id', async (req, res) => {
    await db.query('DELETE FROM tables WHERE id = $1', [req.params.id]);
    res.status(204).end();
  });
  /** QR-код стола: PNG (по умолчанию) или SVG (?format=svg) для печати. */
  r.get('/tables/:id/qr', async (req, res) => {
    const t = (await db.query('SELECT * FROM tables WHERE id = $1', [req.params.id])).rows[0];
    if (!t) throw new HttpError(404, 'Not found');
    const link = tableLink(t.code);
    if (req.query.format === 'svg') {
      res.type('image/svg+xml').send(await QRCode.toString(link, { type: 'svg', margin: 2, errorCorrectionLevel: 'H' }));
    } else {
      const png = await QRCode.toBuffer(link, { type: 'png', width: 800, margin: 2, errorCorrectionLevel: 'H' });
      res.type('image/png').send(png);
    }
  });
  return r;
}
