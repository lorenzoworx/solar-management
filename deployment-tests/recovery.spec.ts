import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { monitoringSchema, sessionSchema, singleSiteSchema } from '@solar-management/shared';

const execute = promisify(execFile);

// This suite intentionally stops containers. Restrict it to the disposable CI project.
function compose(args: string[], image = process.env.APP_IMAGE) {
  if (process.env.CI !== 'true' || image?.startsWith('solar-management:ci') !== true) {
    throw new Error('Recovery tests require disposable CI images and the sm-ci Compose project.');
  }
  return execute('docker', ['compose', '--env-file', '.env.production.example', '-p', 'sm-ci', ...args], {
    env: { ...process.env, APP_IMAGE: image }, timeout: 90000,
  });
}

async function waitForReady(request: APIRequestContext) {
  await expect.poll(async () => {
    try { return (await request.get('/api/ready', { timeout: 3000 })).status(); }
    catch { return 0; }
  }, { timeout: 60000, intervals: [500, 1000, 2000] }).toBe(200);
}

test('login and owned data survive an outage, restart, rollback, and return to the current image', async ({ page, context, request }) => {
  const currentImage = process.env.APP_IMAGE;
  const previousImage = process.env.ROLLBACK_IMAGE;
  expect(currentImage).toBe('solar-management:ci');
  expect(previousImage).toBe('solar-management:ci-previous');
  // Assert the guard before creating any test data or changing containers.
  await compose(['ps', '--quiet', 'app']);

  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill('Recovery Tester');
  await page.getByLabel('Email').fill(`recovery-${randomUUID()}@example.test`);
  await page.getByLabel('Password').fill(randomUUID() + randomUUID());
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My installations' })).toBeVisible();

  // This request context shares the browser's cookie jar; never log session tokens.
  const browserApi = context.request;
  const session = sessionSchema.parse(await (await browserApi.get('/api/auth/session')).json());
  expect(session.user).not.toBeNull();
  const headers = { 'x-csrf-token': session.csrfToken };
  const created = await browserApi.post('/api/sites', {
    headers, data: { name: 'Recovery rooftop', location: 'Test deployment', capacityKw: 4 },
  });
  expect(created.status()).toBe(201);
  const { site } = singleSiteSchema.parse(await created.json());
  const reading = {
    recordedAt: new Date().toISOString(), solarPowerKw: 0, acVoltageV: 230, inverterTempC: 50,
  };
  const ingested = await browserApi.post(`/api/sites/${site.id}/readings`, { headers, data: reading });
  expect(ingested.status()).toBe(201);
  const originalCookie = (await context.cookies()).find((cookie) => cookie.name === '__Host-sm_session');
  expect(originalCookie).toMatchObject({ secure: true, httpOnly: true, sameSite: 'Lax', path: '/' });

  async function verifySavedAccount() {
    const activeSession = sessionSchema.parse(await (await browserApi.get('/api/auth/session')).json());
    expect(activeSession.user).toEqual(session.user);
    expect(activeSession.csrfToken === session.csrfToken).toBe(true);
    const monitoring = await browserApi.get(`/api/sites/${site.id}/monitoring`);
    expect(monitoring.status()).toBe(200);
    const data = monitoringSchema.parse(await monitoring.json());
    expect(data.site.name).toBe('Recovery rooftop');
    expect(data.latest).toMatchObject(reading);
    expect(data.alerts).toHaveLength(1);
    expect(data.alerts[0]).toMatchObject({ type: 'high_temperature', resolvedAt: null });
    const cookie = (await context.cookies()).find((entry) => entry.name === '__Host-sm_session');
    expect(cookie?.value === originalCookie?.value).toBe(true);
    await page.goto(`/sites/${site.id}`);
    await expect(page.getByRole('heading', { name: 'Recovery rooftop' })).toBeVisible();
    await expect(page.getByText('Inverter temperature reached 50 °C')).toBeVisible();
  }

  async function replaceApplication(image: string) {
    await compose(['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '60', 'app'], image);
    await waitForReady(request);
    const { stdout: containerId } = await compose(['ps', '--quiet', 'app'], image);
    const { stdout: runningImage } = await execute('docker', ['inspect', '--format', '{{.Config.Image}}', containerId.trim()]);
    expect(runningImage.trim()).toBe(image);
  }

  try {
    await test.step('database outage produces safe errors and a failed readiness check', async () => {
      await compose(['stop', 'db']);
      expect((await request.get('/api/ready')).status()).toBe(503);
      const unavailable = await browserApi.get('/api/sites');
      expect(unavailable.status()).toBe(503);
      expect(await unavailable.json()).toEqual({ error: { message: 'The service is temporarily unavailable. Please try again.' } });
      expect((await request.get('/api/health')).status()).toBe(200);
    });
    await test.step('restart keeps the existing login, site, reading, and alert', async () => {
      await compose(['start', 'db']);
      await compose(['restart', 'app']);
      await waitForReady(request);
      await verifySavedAccount();
    });
    await test.step('roll back to the preceding compatible revision', async () => {
      await replaceApplication(previousImage!);
      await verifySavedAccount();
    });
    await test.step('return to the current image and verify writes still work', async () => {
      await replaceApplication(currentImage!);
      await verifySavedAccount();
      const removed = await browserApi.delete(`/api/sites/${site.id}`, { headers });
      expect(removed.status()).toBe(204);
      const loggedOut = await browserApi.post('/api/auth/logout', { headers, data: {} });
      expect(loggedOut.status()).toBe(204);
      expect((await browserApi.get('/api/sites')).status()).toBe(401);
    });
  } finally {
    // A failed assertion must not leave the database stopped or the old app selected.
    await compose(['start', 'db']);
    await compose(['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '60', 'app'], currentImage);
  }
});
