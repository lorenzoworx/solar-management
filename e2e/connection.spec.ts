import { expect, test } from '@playwright/test';

test('the browser reaches the real API through the development proxy', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Connected');
  await page.getByText('View API response').click();
  await expect(page.locator('pre')).toContainText('solar-management-api');
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByRole('status')).toHaveText('Connected');
});

test('a failed request can be retried on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/health', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Could not reach');
  await page.unroute('**/api/health');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('status')).toHaveText('Connected');
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
