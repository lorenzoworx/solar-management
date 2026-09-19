import '../src/config.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { isDemoSitesResponse } from '@solar-management/shared';
import { createApp } from '../src/app.js';
import { createPool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { seedDemoSites } from '../src/db/seed.js';

// This suite clears data: never fall back to the application's database.
const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== '/solar_management_test') {
  throw new Error('TEST_DATABASE_URL must point to the dedicated solar_management_test database.');
}
if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === '/solar_management_test') {
  throw new Error('The application must not use the test database.');
}
const pool = createPool(url);
const app = createApp(undefined, pool);
beforeAll(() => migrate(url));
beforeEach(() => pool.query('TRUNCATE sites, sessions, users CASCADE'));
afterAll(() => pool.end());

describe('saved demo installations (real PostgreSQL)', () => {
  it('runs migrations and the seed repeatedly without duplicating records', async () => {
    expect(await migrate(url)).toHaveLength(0);
    await seedDemoSites(pool);
    await seedDemoSites(pool);
    const response = await request(app).get('/api/demo/sites');
    expect(response.status).toBe(200);
    expect(isDemoSitesResponse(response.body)).toBe(true);
    expect(response.body.sites).toHaveLength(3);
    expect(response.body.sites[0]).toEqual({
      id: '10000000-0000-4000-8000-000000000001', name: 'Cedar House', location: 'Austin, TX', capacityKw: 6.4,
    });
  });

  it('returns an empty list when nothing has been seeded', async () => {
    const response = await request(app).get('/api/demo/sites');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ sites: [] });
    expect((await request(app).get('/api/ready')).body).toEqual({ status: 'ready' });
  });

  it('excludes non-demo records even when the caller asks for them', async () => {
    await seedDemoSites(pool);
    const owner = await pool.query("INSERT INTO users (name, email, password_hash) VALUES ('Owner', 'owner@example.test', 'fixture') RETURNING id");
    await pool.query('INSERT INTO sites (name, location, capacity_kw, owner_id) VALUES ($1, $2, $3, $4)', ["Owner's private site", 'Chicago, IL', 5, owner.rows[0].id]);
    const response = await request(app).get('/api/demo/sites?is_demo=false');
    expect(response.body.sites).toHaveLength(3);
    expect(response.text).not.toContain("Owner's private site");
    await seedDemoSites(pool);
    expect((await pool.query('SELECT count(*)::int AS count FROM sites')).rows[0].count).toBe(4);
  });

  it('rejects demo mutation requests without changing records', async () => {
    await seedDemoSites(pool);
    for (const method of ['post', 'put', 'patch', 'delete'] as const) {
      expect((await request(app)[method]('/api/demo/sites')).status).toBe(404);
    }
    expect((await pool.query('SELECT count(*)::int AS count FROM sites')).rows[0].count).toBe(3);
  });

  it.each([0, -1, 'NaN', 1000001])('rejects invalid capacity %s in the database', async (capacity) => {
    await expect(pool.query('INSERT INTO sites (name, location, capacity_kw, is_demo) VALUES ($1, $2, $3, true)', ['Test site', 'Test location', capacity]))
      .rejects.toMatchObject({ code: '23514' });
  });

  it('returns a safe failure while the API health check remains available', async () => {
    const unreachableUrl = new URL(url);
    unreachableUrl.hostname = '127.0.0.1';
    unreachableUrl.port = '1';
    const unavailablePool = createPool(unreachableUrl.toString());
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const unavailableApp = createApp(undefined, unavailablePool);
      const response = await request(unavailableApp).get('/api/demo/sites');
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: { message: 'Installations are temporarily unavailable. Please try again.' } });
      expect((await request(unavailableApp).get('/api/health')).status).toBe(200);
      expect((await request(unavailableApp).get('/api/ready')).status).toBe(503);
    } finally {
      await unavailablePool.end();
      log.mockRestore();
    }
  });
});
