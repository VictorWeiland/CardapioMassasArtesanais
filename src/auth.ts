import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db';

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const calculatedHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(storedHash));
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export interface AdminUser {
  id: number;
  username: string;
  created_at: string;
}

export interface AuthenticatedRequest extends Request {
  adminUser?: AdminUser;
}

/**
 * Express middleware to protect sensitive administrative routes
 */
export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token.trim();
  }

  if (!token) {
    return res.status(401).json({ error: 'Acesso restrito. Faça login para continuar.' });
  }

  try {
    const session = db.prepare(`
      SELECT s.*, a.username, a.created_at as user_created_at
      FROM sessions s
      INNER JOIN admins a ON s.admin_id = a.id
      WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
    `).get(token) as any;

    if (!session) {
      return res.status(401).json({ error: 'Sessão expirada ou inválida. Faça login novamente.' });
    }

    req.adminUser = {
      id: session.admin_id,
      username: session.username,
      created_at: session.user_created_at
    };

    next();
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao validar autenticação', details: error.message });
  }
}
