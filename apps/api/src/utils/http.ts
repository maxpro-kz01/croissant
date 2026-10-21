import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new HttpError(400, r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), 'validation');
  }
  return r.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation error', code: 'validation' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

export function randomId(len = 8): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s;
}
