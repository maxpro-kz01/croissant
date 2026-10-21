import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';

export type Role = 'admin' | 'staff';
export interface AuthUser {
  id: number;
  username: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.jwtSecret, { expiresIn: '12h' });
}

export function verifyToken(token: string): AuthUser {
  try {
    const p = jwt.verify(token, env.jwtSecret) as AuthUser;
    return { id: p.id, username: p.username, role: p.role };
  } catch {
    throw new HttpError(401, 'Unauthorized');
  }
}

/** Требует вход. Для SSE токен можно передать в ?token=, т.к. EventSource не умеет заголовки. */
export function requireAuth(roles: Role[] = ['admin', 'staff']) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : (req.query.token as string | undefined);
    if (!token) throw new HttpError(401, 'Unauthorized');
    const user = verifyToken(token);
    if (!roles.includes(user.role)) throw new HttpError(403, 'Forbidden');
    req.user = user;
    next();
  };
}
