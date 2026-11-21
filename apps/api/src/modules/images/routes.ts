import { randomUUID } from 'node:crypto';
import express, { Router, type NextFunction, type Request, type Response } from 'express';
import type { Db } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { HttpError } from '../../utils/http.js';

/** Клиент заранее сжимает фото (до ~1000 px), так что 3 МБ — с большим запасом. */
const MAX_BYTES = 3 * 1024 * 1024;

/** Определяем тип по первым байтам, а не по заголовку: присланному Content-Type верить нельзя. */
export function sniffImage(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function publicImagesRouter(db: Db) {
  const r = Router();
  r.get('/images/:id', async (req, res) => {
    const id = String(req.params.id);
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, 'Not found');
    const row = (await db.query('SELECT mime, data FROM images WHERE id = $1', [id])).rows[0] as { mime: string; data: Buffer } | undefined;
    if (!row) throw new HttpError(404, 'Not found');
    res.set({
      'Content-Type': row.mime,
      // id никогда не повторяется (новое фото = новый id), поэтому кэшируем надолго.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(row.data);
  });
  return r;
}

/** Читает тело запроса как байты; слишком большое тело превращает в понятную ошибку 413. */
function rawBody(req: Request, res: Response, next: NextFunction) {
  express.raw({ type: () => true, limit: MAX_BYTES })(req, res, (err?: unknown) => {
    if (err) return next(new HttpError(413, 'Фото слишком большое', 'too_large'));
    next();
  });
}

export function adminImagesRouter(db: Db) {
  const r = Router();
  r.post('/images', requireAuth(['admin']), rawBody, async (req, res) => {
    const body = req.body as unknown;
    if (!Buffer.isBuffer(body) || body.length === 0) throw new HttpError(400, 'Файл не получен', 'no_file');
    const mime = sniffImage(body);
    if (!mime) throw new HttpError(400, 'Нужна картинка JPEG, PNG или WebP', 'bad_image');
    const id = randomUUID();
    await db.query('INSERT INTO images(id, mime, data) VALUES ($1, $2, $3)', [id, mime, body]);
    res.status(201).json({ url: `/api/images/${id}` });
  });
  return r;
}
