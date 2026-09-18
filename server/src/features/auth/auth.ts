import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Pool } from 'pg';
import { credentialsSchema, registrationSchema, type PublicUser } from '@solar-management/shared';
import { hasCode, HttpError } from '../../http.js';
import { transaction } from '../../db/transaction.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { clearSessionCookie, csrfProtection, insertSession, loadSession, sendSession, type SecurityOptions } from './sessions.js';

export function authRouter(pool: Pool, options: SecurityOptions) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: options.authLimit ?? 20,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { message: 'Too many account attempts. Please try again in 15 minutes.' } },
  });
  // Apply before any expensive password hashing or session lookups for these routes.
  router.use(['/register', '/login'], limiter);
  router.use('/session', rateLimit({
    windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { message: 'Too many session requests. Please try again later.' } },
  }));
  router.use(loadSession(pool, options), csrfProtection(options));
  router.get('/session', async (request, response) => {
    if (request.authSession) {
      response.json({ user: request.authSession.user, csrfToken: request.authSession.csrfToken });
    } else {
      sendSession(response, options, await insertSession(pool, options, null));
    }
  });
  router.post('/register', async (request, response) => {
    const input = registrationSchema.parse(request.body);
    const passwordHash = await hashPassword(input.password);
    try {
      const session = await transaction(pool, async (client) => {
        const result = await client.query<PublicUser>('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
          [input.name, input.email, passwordHash]);
        await client.query('DELETE FROM sessions WHERE id = $1', [request.authSession!.id]);
        return insertSession(client, options, result.rows[0]!);
      });
      sendSession(response, options, session, 201);
    } catch (error) {
      if (hasCode(error, '23505')) throw new HttpError(409, 'An account with this email already exists.');
      throw error;
    }
  });
  router.post('/login', async (request, response) => {
    const input = credentialsSchema.parse(request.body);
    const result = await pool.query<PublicUser & { passwordHash: string }>(
      'SELECT id, name, email, password_hash AS "passwordHash" FROM users WHERE email = $1', [input.email]);
    const user = result.rows[0];
    const valid = await verifyPassword(input.password, user?.passwordHash);
    if (!user || !valid) throw new HttpError(401, 'Email or password is incorrect.');
    const session = await transaction(pool, async (client) => {
      await client.query('DELETE FROM sessions WHERE id = $1', [request.authSession!.id]);
      return insertSession(client, options, { id: user.id, name: user.name, email: user.email });
    });
    sendSession(response, options, session);
  });
  router.post('/logout', async (request, response) => {
    await pool.query('DELETE FROM sessions WHERE id = $1', [request.authSession!.id]);
    clearSessionCookie(response, options);
    response.status(204).end();
  });
  return router;
}
