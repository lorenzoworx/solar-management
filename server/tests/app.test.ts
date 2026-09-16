import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isHealthResponse } from '@solar-management/shared';
import { createApp } from '../src/app.js';

const clientDirectory = mkdtempSync(join(tmpdir(), 'solar-client-test-'));
writeFileSync(join(clientDirectory, 'index.html'), '<html><body>Solar test page</body></html>');
afterAll(() => rmSync(clientDirectory, { recursive: true, force: true }));

describe('application boundary', () => {
  it('returns a fresh health response that satisfies the shared contract', async () => {
    const beforeRequest = Date.now();
    const response = await request(createApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['cache-control']).toBe('no-store');
    const body: unknown = response.body;
    expect(isHealthResponse(body)).toBe(true);
    if (!isHealthResponse(body)) throw new Error('Invalid health response');
    expect(Date.parse(body.timestamp)).toBeGreaterThanOrEqual(beforeRequest);
    expect(Date.parse(body.timestamp)).toBeLessThanOrEqual(Date.now());
  });

  it('keeps unknown API requests as JSON 404s even with frontend hosting enabled', async () => {
    const response = await request(createApp(clientDirectory)).get('/api/unknown');
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toEqual({ error: { message: 'API route not found' } });
  });

  it('serves the frontend for browser routes in the production configuration', async () => {
    const response = await request(createApp(clientDirectory)).get('/future-page');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Solar test page');
  });
});
