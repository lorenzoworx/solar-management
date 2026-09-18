import '../src/config.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createPool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { seedDemoSites } from '../src/db/seed.js';
import { verifyPassword } from '../src/features/auth/passwords.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== '/solar_management_test' || (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === '/solar_management_test')) {
  throw new Error('Configure separate development and solar_management_test databases.');
}
const pool = createPool(url);
const security = { production: false, origin: 'http://127.0.0.1:5175', trustProxy: 0, authLimit: 100 };
let app = createApp(undefined, pool, security);
beforeAll(() => migrate(url));
beforeEach(async () => {
  await pool.query('TRUNCATE sites, sessions, users CASCADE');
  app = createApp(undefined, pool, security);
});
afterAll(() => pool.end());
const password = 'A long test passphrase!';
const input = { name: 'Roof array', location: 'Austin, TX', capacityKw: 6.4 };
function setCookie(response: request.Response): string {
  const value: unknown = response.headers['set-cookie'];
  if (!Array.isArray(value) || typeof value[0] !== 'string') throw new Error('Expected a session cookie.');
  return value[0];
}
const cookie = (response: request.Response) => setCookie(response).split(';')[0]!;
async function register(agent: ReturnType<typeof request.agent>, email = 'alice@example.test') {
  const anonymous = await agent.get('/api/auth/session');
  const response = await agent.post('/api/auth/register').set('X-CSRF-Token', anonymous.body.csrfToken).send({ name: 'Test User', email, password });
  expect(response.status).toBe(201);
  return response;
}

describe('accounts, sessions, and ownership', () => {
  it('hashes passwords, normalizes email, rotates sessions, and survives another app instance', async () => {
    const agent = request.agent(app);
    const initial = await agent.get('/api/auth/session');
    const response = await register(agent, 'ALICE@EXAMPLE.TEST');
    expect(response.body.user.email).toBe('alice@example.test');
    expect(cookie(response)).not.toBe(cookie(initial));
    expect(response.text).not.toContain('password');
    expect(setCookie(response)).toMatch(/HttpOnly/);
    expect(setCookie(response)).toMatch(/SameSite=Lax/);
    const user = (await pool.query('SELECT password_hash FROM users')).rows[0];
    expect(user.password_hash).not.toBe(password);
    expect(await verifyPassword(password, user.password_hash)).toBe(true);
    const nextApp = createApp(undefined, pool, security);
    const loaded = await request(nextApp).get('/api/auth/session').set('Cookie', cookie(response));
    expect(loaded.body.user.id).toBe(response.body.user.id);
    expect((await request(app).get('/api/sites').set('Cookie', cookie(initial))).status).toBe(401);
  });

  it('supports login and invalidates the old cookie on logout', async () => {
    const agent = request.agent(app);
    const created = await register(agent);
    const loggedOut = await agent.post('/api/auth/logout').set('X-CSRF-Token', created.body.csrfToken).send({});
    expect(loggedOut.status).toBe(204);
    expect((await request(app).get('/api/sites').set('Cookie', cookie(created))).status).toBe(401);
    const fresh = await agent.get('/api/auth/session');
    const wrong = await agent.post('/api/auth/login').set('X-CSRF-Token', fresh.body.csrfToken).send({ email: 'alice@example.test', password: 'An incorrect password!' });
    const unknown = await agent.post('/api/auth/login').set('X-CSRF-Token', fresh.body.csrfToken).send({ email: 'nobody@example.test', password });
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    const loggedIn = await agent.post('/api/auth/login').set('X-CSRF-Token', fresh.body.csrfToken).send({ email: 'alice@example.test', password });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.user.id).toBe(created.body.user.id);
  });

  it('provides complete CRUD while denying another user reads, updates, and deletes', async () => {
    const alice = request.agent(app), bob = request.agent(app);
    const a = await register(alice), b = await register(bob, 'bob@example.test');
    const created = await alice.post('/api/sites').set('X-CSRF-Token', a.body.csrfToken).send(input);
    expect(created.status).toBe(201);
    const path = '/api/sites/' + created.body.site.id;
    expect((await alice.get(path)).body.site).toEqual(created.body.site);
    expect((await bob.get('/api/sites')).body.sites).toEqual([]);
    expect((await bob.get(path)).status).toBe(404);
    expect((await bob.put(path).set('X-CSRF-Token', b.body.csrfToken).send(input)).status).toBe(404);
    expect((await bob.delete(path).set('X-CSRF-Token', b.body.csrfToken)).status).toBe(404);
    const updated = await alice.put(path).set('X-CSRF-Token', a.body.csrfToken).send({ ...input, name: "Owner's revised array", capacityKw: 0.125 });
    expect(updated.body.site.name).toBe("Owner's revised array");
    expect(updated.body.site.capacityKw).toBe(0.125);
    expect((await alice.delete(path).set('X-CSRF-Token', a.body.csrfToken)).status).toBe(204);
    expect((await alice.get(path)).status).toBe(404);
  });

  it('protects demos against mutation through owned-site endpoints', async () => {
    await seedDemoSites(pool);
    const agent = request.agent(app), auth = await register(agent);
    const path = '/api/sites/10000000-0000-4000-8000-000000000001';
    expect((await agent.get(path)).status).toBe(404);
    expect((await agent.put(path).set('X-CSRF-Token', auth.body.csrfToken).send(input)).status).toBe(404);
    expect((await agent.delete(path).set('X-CSRF-Token', auth.body.csrfToken)).status).toBe(404);
    expect((await agent.post('/api/sites').set('X-CSRF-Token', auth.body.csrfToken).send({ ...input, is_demo: true })).status).toBe(400);
    expect((await request(app).get('/api/demo/sites')).body.sites).toHaveLength(3);
  });

  it('rejects expired sessions, missing CSRF tokens, and cross-origin writes', async () => {
    const agent = request.agent(app), auth = await register(agent);
    expect((await agent.post('/api/sites').send(input)).status).toBe(403);
    expect((await agent.post('/api/sites').set('X-CSRF-Token', 'a'.repeat(43)).send(input)).status).toBe(403);
    expect((await agent.post('/api/sites').set('X-CSRF-Token', auth.body.csrfToken).set('Origin', 'https://evil.example').send(input)).status).toBe(403);
    await pool.query("UPDATE sessions SET expires_at = now() - interval '1 second'");
    expect((await agent.get('/api/sites')).status).toBe(401);
    expect((await agent.post('/api/sites').set('X-CSRF-Token', auth.body.csrfToken).send(input)).status).toBe(401);
    expect((await agent.get('/api/auth/session')).body.user).toBeNull();
  });

  it('enforces validation, ownership input restrictions, and parameterized string values', async () => {
    const agent = request.agent(app), auth = await register(agent);
    for (const body of [{ ...input, capacityKw: 0 }, { ...input, capacityKw: '6' }, { ...input, capacityKw: 0.0001 }, { ...input, name: ' ' }, { ...input, owner_id: auth.body.user.id }]) {
      expect((await agent.post('/api/sites').set('X-CSRF-Token', auth.body.csrfToken).send(body)).status).toBe(400);
    }
    const name = "Robert'); DROP TABLE sites; --";
    const response = await agent.post('/api/sites').set('X-CSRF-Token', auth.body.csrfToken).send({ ...input, name });
    expect(response.status).toBe(201);
    expect((await agent.get('/api/sites')).body.sites[0].name).toBe(name);
    expect((await agent.get('/api/sites/not-a-uuid')).status).toBe(400);
    expect((await agent.post('/api/sites').set('X-CSRF-Token', auth.body.csrfToken).set('Content-Type', 'application/json').send('{')).status).toBe(400);
  });

  it('rejects duplicate accounts and weak passwords without creating extra users', async () => {
    const agent = request.agent(app), auth = await register(agent);
    const duplicate = await agent.post('/api/auth/register').set('X-CSRF-Token', auth.body.csrfToken).send({ name: 'Second', email: 'ALICE@example.test', password });
    expect(duplicate.status).toBe(409);
    const invalid = await agent.post('/api/auth/register').set('X-CSRF-Token', auth.body.csrfToken).send({ name: 'Second', email: 'other@example.test', password: 'short' });
    expect(invalid.status).toBe(400);
    expect((await pool.query('SELECT count(*)::int AS count FROM users')).rows[0].count).toBe(1);
  });

  it('rate limits account attempts', async () => {
    const limited = request.agent(createApp(undefined, pool, { ...security, authLimit: 2 }));
    const csrf = (await limited.get('/api/auth/session')).body.csrfToken;
    for (let i = 0; i < 2; i++) expect((await limited.post('/api/auth/login').set('X-CSRF-Token', csrf).send({})).status).toBe(400);
    const blocked = await limited.post('/api/auth/login').set('X-CSRF-Token', csrf).send({});
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('sets host-only secure cookies and requires HTTPS in production', async () => {
    const production = createApp(undefined, pool, { ...security, production: true, origin: 'https://solar.example', trustProxy: 1 });
    const session = await request(production).get('/api/auth/session').set('X-Forwarded-Proto', 'https');
    expect(setCookie(session)).toMatch(/^__Host-sm_session=/);
    expect(setCookie(session)).toContain('Secure');
    expect(setCookie(session)).not.toContain('Domain=');
    const response = await request(production).post('/api/auth/logout').set('Cookie', cookie(session)).set('X-CSRF-Token', session.body.csrfToken).send({});
    expect(response.status).toBe(403);
    expect((await request(production).post('/api/auth/logout').set('X-Forwarded-Proto', 'https').set('Origin', 'https://solar.example').set('Cookie', cookie(session)).set('X-CSRF-Token', session.body.csrfToken).send({})).status).toBe(204);
  });

  it('returns safe JSON when the session database is unavailable', async () => {
    const unavailableUrl = new URL(url); unavailableUrl.hostname = '127.0.0.1'; unavailableUrl.port = '1';
    const unavailablePool = createPool(unavailableUrl.toString());
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await request(createApp(undefined, unavailablePool, security)).get('/api/auth/session');
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: { message: 'The service is temporarily unavailable. Please try again.' } });
    } finally { await unavailablePool.end(); log.mockRestore(); }
  });
});
