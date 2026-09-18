import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { parse } from 'cookie';
import type { Pool, PoolClient } from 'pg';
import type { RequestHandler, Response } from 'express';
import type { PublicUser } from '@solar-management/shared';
import { HttpError } from '../../http.js';

export interface SecurityOptions {
  production: boolean;
  origin: string;
  trustProxy: number;
  sessionTtlMs?: number;
  authLimit?: number;
}
export interface AuthSession { id: string; csrfToken: string; user: PublicUser | null }
declare module 'express-serve-static-core' {
  interface Request { authSession?: AuthSession }
}

function cookieName(options: SecurityOptions) { return options.production ? '__Host-sm_session' : 'sm_session'; }
function cookieOptions(options: SecurityOptions) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: options.production, path: '/' };
}
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export function loadSession(pool: Pool, options: SecurityOptions): RequestHandler {
  return async (request, _response, next) => {
    const token = parse(request.headers.cookie ?? '')[cookieName(options)];
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
      const result = await pool.query<AuthSession>(`
        SELECT s.id, s.csrf_token AS "csrfToken",
          CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id', u.id, 'name', u.name, 'email', u.email) END AS "user"
        FROM sessions s LEFT JOIN users u ON u.id = s.user_id
        WHERE s.id = $1 AND s.expires_at > now()
      `, [digest(token)]);
      if (result.rows[0]) request.authSession = result.rows[0];
    }
    next();
  };
}

export async function insertSession(client: Pool | PoolClient, options: SecurityOptions, user: PublicUser | null) {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const ttl = options.sessionTtlMs ?? 24 * 60 * 60 * 1000;
  await client.query('INSERT INTO sessions (id, user_id, csrf_token, expires_at) VALUES ($1, $2, $3, $4)',
    [digest(token), user?.id ?? null, csrfToken, new Date(Date.now() + ttl)]);
  return { token, csrfToken, user, ttl };
}

export function sendSession(response: Response, options: SecurityOptions, session: Awaited<ReturnType<typeof insertSession>>, status = 200) {
  response.cookie(cookieName(options), session.token, { ...cookieOptions(options), maxAge: session.ttl });
  response.status(status).json({ user: session.user, csrfToken: session.csrfToken });
}
export function clearSessionCookie(response: Response, options: SecurityOptions) {
  response.clearCookie(cookieName(options), cookieOptions(options));
}

export const requireUser: RequestHandler = (request, _response, next) => {
  if (!request.authSession?.user) throw new HttpError(401, 'Please log in to manage your installations.');
  next();
};

export function csrfProtection(options: SecurityOptions): RequestHandler {
  return (request, _response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) { next(); return; }
    const origin = request.get('origin');
    if ((origin && origin !== options.origin) || request.get('sec-fetch-site') === 'cross-site') {
      throw new HttpError(403, 'Request origin is not allowed.');
    }
    if (options.production && !request.secure) throw new HttpError(403, 'HTTPS is required.');
    const provided = request.get('x-csrf-token') ?? '';
    const expected = request.authSession?.csrfToken;
    if (!expected || !/^[A-Za-z0-9_-]{43}$/.test(provided) || provided.length !== expected.length ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
      throw new HttpError(403, 'Session expired or invalid security token. Refresh and try again.');
    }
    if (request.method !== 'DELETE' && !request.is('application/json')) throw new HttpError(415, 'Use application/json.');
    next();
  };
}
