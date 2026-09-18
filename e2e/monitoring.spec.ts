import { expect, test } from '@playwright/test';

test('demo charts show dated samples, coverage, alerts, and date-filtered empty states', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('link', { name: 'View monitoring' }).first().click();
  await expect(page.getByRole('heading', { name: 'Cedar House' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Solar power history/ })).toBeVisible();
  await expect(page.getByText('100.0% time coverage', { exact: false })).toBeVisible();
  await expect(page.getByText('Inverter temperature reached 52 °C')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add reading' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Resolve', exact: true })).toHaveCount(0);
  await page.getByLabel('From (UTC)').fill('2026-09-11T19:00');
  await page.getByLabel('To (UTC)').fill('2026-09-11T19:15');
  await page.getByRole('button', { name: 'Apply dates' }).click();
  await expect(page).toHaveURL(/from=2026-09-11/);
  await expect(page.getByText('100.0% time coverage', { exact: false })).toBeVisible();
  await page.getByLabel('From (UTC)').fill('2026-09-01T00:00');
  await page.getByLabel('To (UTC)').fill('2026-09-02T00:00');
  await page.getByRole('button', { name: 'Apply dates' }).click();
  await expect(page.getByText('No readings in this date range.')).toBeVisible();
  await expect(page.getByText('0.000 kWh estimated')).toBeVisible();
});

test('missing readings remain visible as incomplete coverage on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/sites/10000000-0000-4000-8000-000000000003');
  await expect(page.getByText('Incomplete coverage', { exact: false })).toBeVisible();
  await expect(page.getByRole('img', { name: /Solar power history/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
