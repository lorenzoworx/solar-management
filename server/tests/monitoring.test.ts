import '../src/config.js';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createPool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { seedDemoSites } from '../src/db/seed.js';
import { DEMO_END, DEMO_START, seedDemoReadings } from '../src/db/seed-readings.js';
import { monitoringSchema } from '@solar-management/shared';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== '/solar_management_test' || (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === '/solar_management_test')) throw new Error('Use the isolated test database.');
const pool = createPool(url), app = createApp(undefined, pool);
beforeAll(() => migrate(url));
beforeEach(() => pool.query('TRUNCATE sites, users, sessions CASCADE'));
afterAll(() => pool.end());
const reading = { recordedAt: '2026-09-11T12:00:00.000Z', solarPowerKw: 2, acVoltageV: 258, inverterTempC: 50 };
async function ownedSite() {
  const agent = request.agent(app), anonymous = await agent.get('/api/auth/session');
  const registration = await agent.post('/api/auth/register').set('X-CSRF-Token', anonymous.body.csrfToken).send({ name: 'Monitor tester', email: 'monitor@example.test', password: 'A monitoring test passphrase!' });
  expect(registration.status).toBe(201);
  const csrf = registration.body.csrfToken as string;
  const site = await agent.post('/api/sites').set('X-CSRF-Token', csrf).send({ name: 'Test system', location: 'Austin', capacityKw: 6 });
  return { agent, csrf, id: site.body.site.id as string };
}

it('ingests readings, distinguishes retries from conflicts, and resolves alerts without replaying them', async () => {
  const { agent, csrf, id } = await ownedSite();
  const path = `/api/sites/${id}`;
  expect((await agent.post(path + '/readings').set('X-CSRF-Token', csrf).send(reading)).status).toBe(201);
  const retry = await agent.post(path + '/readings').set('X-CSRF-Token', csrf).send(reading);
  expect(retry.status).toBe(200); expect(retry.body.created).toBe(false);
  expect((await agent.post(path + '/readings').set('X-CSRF-Token', csrf).send({ ...reading, solarPowerKw: 3 })).status).toBe(409);
  const first = (await agent.get(path + '/monitoring')).body;
  expect(first.alerts).toHaveLength(2);
  expect(monitoringSchema.safeParse(first).success).toBe(true);
  const alertId = first.alerts[0].id as string;
  const resolved = await agent.post(path + `/alerts/${alertId}/resolve`).set('X-CSRF-Token', csrf).send({});
  expect(resolved.status).toBe(200); expect(resolved.body.alert.resolvedAt).not.toBeNull();
  await agent.post(path + '/readings').set('X-CSRF-Token', csrf).send(reading);
  expect((await agent.get(path + '/monitoring')).body.alerts.filter((alert: { resolvedAt: string | null }) => !alert.resolvedAt)).toHaveLength(1);
  const next = await agent.post(path + '/readings').set('X-CSRF-Token', csrf).send({ ...reading, recordedAt: '2026-09-11T12:15:00.000Z', solarPowerKw: 4 });
  expect(next.status).toBe(201);
  const filtered = await agent.get(path + '/monitoring').query({ from: reading.recordedAt, to: '2026-09-11T12:15:00.000Z' });
  expect(filtered.body.summary).toMatchObject({ energyKwh: 0.75, coveragePercent: 100 });
  expect(filtered.body.alerts.filter((alert: { resolvedAt: string | null }) => !alert.resolvedAt)).toHaveLength(2);
});

it('creates at most one unresolved alert per type during concurrent ingestion', async () => {
  const { agent, csrf, id } = await ownedSite();
  const responses = await Promise.all([0, 1, 2, 3].map((minute) => agent.post(`/api/sites/${id}/readings`).set('X-CSRF-Token', csrf)
    .send({ ...reading, recordedAt: new Date(Date.parse(reading.recordedAt) + minute * 60000).toISOString() })));
  expect(responses.every((response) => response.status === 201)).toBe(true);
  expect((await pool.query('SELECT count(*)::int AS count FROM alerts WHERE resolved_at IS NULL')).rows[0].count).toBe(2);
});

it('rolls back a reading if its alert cannot be inserted', async () => {
  const { agent, csrf, id } = await ownedSite();
  await pool.query("CREATE FUNCTION fail_alert_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test alert failure'; END $$");
  await pool.query('CREATE TRIGGER fail_alert_test BEFORE INSERT ON alerts FOR EACH ROW EXECUTE FUNCTION fail_alert_test()');
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect((await agent.post(`/api/sites/${id}/readings`).set('X-CSRF-Token', csrf).send(reading)).status).toBe(503);
    expect((await pool.query('SELECT count(*)::int AS count FROM readings')).rows[0].count).toBe(0);
  } finally {
    await pool.query('DROP FUNCTION fail_alert_test() CASCADE'); log.mockRestore();
  }
});

it('protects private monitoring and public demo mutations, including alert resolution', async () => {
  const { agent, csrf, id } = await ownedSite();
  await seedDemoSites(pool);
  const other = (await pool.query("INSERT INTO users (name, email, password_hash) VALUES ('Other', 'other@example.test', 'fixture') RETURNING id")).rows[0].id;
  const privateId = (await pool.query("INSERT INTO sites (name, location, capacity_kw, owner_id) VALUES ('Other site', 'Elsewhere', 1, $1) RETURNING id", [other])).rows[0].id;
  expect((await agent.get(`/api/sites/${privateId}/monitoring`)).status).toBe(404);
  expect((await request(app).get(`/api/demo/sites/${id}/monitoring`)).status).toBe(404);
  expect((await agent.post(`/api/sites/${privateId}/readings`).set('X-CSRF-Token', csrf).send(reading)).status).toBe(404);
  expect((await agent.post(`/api/sites/${privateId}/alerts/10000000-0000-4000-8000-000000000001/resolve`).set('X-CSRF-Token', csrf).send({})).status).toBe(404);
  const demoId = '10000000-0000-4000-8000-000000000001';
  expect((await agent.post(`/api/sites/${demoId}/readings`).set('X-CSRF-Token', csrf).send(reading)).status).toBe(404);
  expect((await agent.post(`/api/demo/sites/${demoId}/readings`).set('X-CSRF-Token', csrf).send(reading)).status).toBe(404);
  expect((await agent.post(`/api/demo/sites/${demoId}/alerts/${demoId}/resolve`).set('X-CSRF-Token', csrf).send({})).status).toBe(404);
});

it('preserves zeros and nulls, rejects future readings and invalid ranges', async () => {
  const { agent, csrf, id } = await ownedSite();
  const path = `/api/sites/${id}`;
  const response = await agent.post(path + '/readings').set('X-CSRF-Token', csrf).send({ ...reading, solarPowerKw: 0, acVoltageV: null, inverterTempC: null });
  expect(response.body.reading).toMatchObject({ solarPowerKw: 0, acVoltageV: null, inverterTempC: null });
  expect((await agent.get(path + '/monitoring')).body.alerts).toEqual([]);
  expect((await agent.post(path + '/readings').set('X-CSRF-Token', csrf).send({ ...reading, recordedAt: new Date(Date.now() + 600000).toISOString() })).status).toBe(400);
  for (const query of [{ from: reading.recordedAt }, { from: reading.recordedAt, to: reading.recordedAt }, { from: DEMO_START, to: '2026-11-01T00:00:00.000Z' }]) {
    expect((await agent.get(path + '/monitoring').query(query)).status).toBe(400);
  }
});

it('seeds seven reproducible days, shows missing coverage, and leaves existing samples unchanged', async () => {
  await seedDemoSites(pool); await seedDemoReadings(pool); await seedDemoReadings(pool);
  const complete = await request(app).get('/api/demo/sites/10000000-0000-4000-8000-000000000001/monitoring');
  expect(complete.status).toBe(200);
  expect(complete.body.availableRange).toEqual({ from: DEMO_START, to: DEMO_END });
  expect(complete.body.readings).toHaveLength(673);
  expect(complete.body.summary.coveragePercent).toBe(100);
  const incomplete = await request(app).get('/api/demo/sites/10000000-0000-4000-8000-000000000003/monitoring');
  expect(incomplete.body.summary.incomplete).toBe(true);
  expect(incomplete.body.summary.skippedGaps).toBe(1);
});

it('refuses to silently truncate a dense date range', async () => {
  const { agent, id } = await ownedSite();
  await pool.query("INSERT INTO readings (site_id, recorded_at, solar_power_kw) SELECT $1, $2::timestamptz + n * interval '1 second', 1 FROM generate_series(0, 10000) n", [id, DEMO_START]);
  const response = await agent.get(`/api/sites/${id}/monitoring`).query({ from: DEMO_START, to: DEMO_END });
  expect(response.status).toBe(422);
});

it('runs the simulator through HTTP login and ingestion instead of direct SQL', async () => {
  const { id } = await ownedSite();
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing HTTP address');
  try {
    const result = await promisify(execFile)(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../src/simulator.ts', import.meta.url))], {
      env: { ...process.env, SIMULATOR_EMAIL: 'monitor@example.test', SIMULATOR_PASSWORD: 'A monitoring test passphrase!',
        SIMULATOR_SITE_ID: id, SIMULATOR_COUNT: '1', SIMULATOR_API_URL: `http://127.0.0.1:${address.port}` }, timeout: 10000,
    });
    expect(result.stdout).toContain('(simulated)');
    expect((await pool.query('SELECT count(*)::int AS count FROM readings WHERE site_id = $1', [id])).rows[0].count).toBe(1);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
