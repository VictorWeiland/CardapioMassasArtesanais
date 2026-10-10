import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db';

const AUTH_SECRET = process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET || 'padeiro-massas-secret-jwt-token-key-2024';

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const calculatedHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(storedHash));
}

export interface TokenPayload {
  id: number;
  username: string;
  exp: number;
}

/**
 * Generate a stateless HMAC-signed token (persists across all Vercel/serverless instances)
 */
export function createSignedToken(admin: { id: number; username: string }, daysValid: number = 30): string {
  const payload: TokenPayload = {
    id: admin.id,
    username: admin.username,
    exp: Date.now() + daysValid * 24 * 60 * 60 * 1000
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Verify a stateless HMAC-signed token
 */
export function verifySignedToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as TokenPayload;
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
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
export async function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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

  // 1. First verify stateless signed token (serverless resilient: works across any instance without DB lookup)
  const payload = verifySignedToken(token);
  if (payload) {
    req.adminUser = {
      id: payload.id,
      username: payload.username,
      created_at: new Date().toISOString()
    };
    return next();
  }

  // 2. Fallback to sessions table in SQLite for legacy tokens
  try {
    const session = await db.get(`
      SELECT s.*, a.username, a.created_at as user_created_at
      FROM sessions s
      INNER JOIN admins a ON s.admin_id = a.id
      WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
    `, [token]) as any;

    if (session) {
      req.adminUser = {
        id: session.admin_id,
        username: session.username,
        created_at: session.user_created_at
      };
      return next();
    }
  } catch (err) {
    // ignore DB errors on session lookup
  }

  return res.status(401).json({ error: 'Sessão expirada ou inválida. Faça login novamente.' });
}
