import './config.js';
import { setTimeout as pause } from 'node:timers/promises';
import { readingInputSchema, sessionSchema, siteIdSchema } from '@solar-management/shared';

const base = process.env.SIMULATOR_API_URL ?? 'http://127.0.0.1:3001';
const email = process.env.SIMULATOR_EMAIL, password = process.env.SIMULATOR_PASSWORD;
const siteId = siteIdSchema.parse(process.env.SIMULATOR_SITE_ID);
const count = Number(process.env.SIMULATOR_COUNT ?? '12');
const interval = Number(process.env.SIMULATOR_INTERVAL_SECONDS ?? '5');
if (!email || !password) throw new Error('Set SIMULATOR_EMAIL, SIMULATOR_PASSWORD, and SIMULATOR_SITE_ID in your ignored .env file.');
if (!Number.isInteger(count) || count < 1 || count > 10000 || !Number.isFinite(interval) || interval < 1 || interval > 1800) throw new Error('Use 1–10000 readings and a 1–1800 second interval.');
const url = new URL(base);
if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) {
  throw new Error('Simulator credentials require HTTPS except on localhost.');
}
let cookie = '';
async function call(path: string, method = 'GET', body?: unknown, csrfToken?: string) {
  const response = await fetch(new URL('/api' + path, base), {
    method, signal: AbortSignal.timeout(10000), redirect: 'error',
    headers: { Cookie: cookie, 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const received = response.headers.getSetCookie()[0];
  if (received) cookie = received.split(';')[0]!;
  return response;
}
const initial = await call('/auth/session');
if (!initial.ok) throw new Error(`Cannot start session (HTTP ${initial.status}).`);
const anonymous = sessionSchema.parse(await initial.json());
const login = await call('/auth/login', 'POST', { email, password }, anonymous.csrfToken);
if (!login.ok) throw new Error(`Login failed (HTTP ${login.status}).`);
const session = sessionSchema.parse(await login.json());
try {
  for (let index = 0; index < count; index++) {
    const reading = readingInputSchema.parse({
      recordedAt: new Date().toISOString(), solarPowerKw: Math.round((3 + Math.sin(index / 4)) * 1000) / 1000,
      acVoltageV: 230, inverterTempC: index % 10 === 9 ? 51 : 35,
    });
    // The payload is created once: a lost response is retried with the same timestamp.
    for (let attempt = 0; ; attempt++) {
      const response = await call(`/sites/${siteId}/readings`, 'POST', reading, session.csrfToken).catch(() => null);
      if (response?.ok) break;
      if ((response && response.status < 500) || attempt === 2) throw new Error(`Ingestion failed (${response ? 'HTTP ' + response.status : 'network error'}).`);
      await pause(500 * 2 ** attempt);
    }
    console.log(`${index + 1}/${count}: ${reading.recordedAt} · ${reading.solarPowerKw} kW (simulated)`);
    if (index + 1 < count) await pause(interval * 1000);
  }
} finally {
  await call('/auth/logout', 'POST', {}, session.csrfToken).catch(() => {});
}
