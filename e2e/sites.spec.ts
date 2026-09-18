import { expect, test } from '@playwright/test';

test('shows persisted sample sites after reload on desktop and mobile', async ({ page }) => {
  await page.goto('/demo');
  const sites = page.getByRole('region', { name: 'Sample installations' });
  await expect(sites.getByRole('listitem')).toHaveCount(3);
  await expect(sites.getByRole('heading', { name: 'Cedar House' })).toBeVisible();
  await expect(sites.getByRole('listitem').first()).toContainText('6.4 kW');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(sites.getByRole('listitem')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('recovers from an installation API failure', async ({ page }) => {
  await page.route('**/api/demo/sites', (route) => route.fulfill({ status: 503, json: { error: { message: 'Unavailable' } } }));
  await page.goto('/demo');
  await expect(page.getByRole('alert')).toContainText('HTTP 503');
  await page.unroute('**/api/demo/sites');
  await page.getByRole('button', { name: 'Retry installations' }).click();
  await expect(page.getByRole('heading', { name: 'Cedar House' })).toBeVisible();
});
