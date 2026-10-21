import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Db } from '../../db/pool.js';
import { requireAuth, signToken } from '../../middleware/auth.js';
import { HttpError, parse } from '../../utils/http.js';

const loginSchema = z.object({ username: z.string().min(1).max(60), password: z.string().min(1).max(200) });
const userSchema = z.object({
  username: z.string().min(3).max(60),
  password: z.string().min(8).max(200),
  role: z.enum(['admin', 'staff']),
});

export function authRouter(db: Db, loginLimitPerMinute = 10) {
  const r = Router();
  const limiter = rateLimit({ windowMs: 60_000, limit: loginLimitPerMinute, standardHeaders: true, legacyHeaders: false });

  r.post('/auth/login', limiter, async (req, res) => {
    const { username, password } = parse(loginSchema, req.body);
    const u = (await db.query('SELECT * FROM users WHERE username = $1', [username])).rows[0];
    // Сравниваем хэш даже если пользователя нет — ответ не выдаёт, существует ли логин.
    const ok = await bcrypt.compare(password, u?.password_hash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
    if (!u || !ok) throw new HttpError(401, 'Invalid credentials', 'bad_credentials');
    const user = { id: u.id, username: u.username, role: u.role };
    res.json({ token: signToken(user), user });
  });

  r.get('/auth/me', requireAuth(), (req, res) => res.json({ user: req.user }));

  // Управление сотрудниками (только администратор)
  r.get('/admin/users', requireAuth(['admin']), async (_req, res) => {
    res.json((await db.query('SELECT id, username, role, created_at FROM users ORDER BY id')).rows);
  });
  r.post('/admin/users', requireAuth(['admin']), async (req, res) => {
    const b = parse(userSchema, req.body);
    const hash = await bcrypt.hash(b.password, 10);
    try {
      const row = (
        await db.query('INSERT INTO users(username,password_hash,role) VALUES ($1,$2,$3) RETURNING id, username, role', [b.username, hash, b.role])
      ).rows[0];
      res.status(201).json(row);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new HttpError(409, 'Username already exists', 'duplicate');
      throw e;
    }
  });
  r.delete('/admin/users/:id', requireAuth(['admin']), async (req, res) => {
    if (Number(req.params.id) === req.user!.id) throw new HttpError(400, 'You cannot delete yourself');
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.status(204).end();
  });
  return r;
}
