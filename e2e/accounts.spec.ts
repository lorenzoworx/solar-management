import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('a visitor can try the demo without registering', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Try demo' }).click();
  await expect(page.getByText('Read-only demo')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cedar House' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add installation' })).toHaveCount(0);
});

test('registration, persistent login, site CRUD, logout and login', async ({ page }) => {
  const email = `browser-${randomUUID()}@example.test`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill('Portfolio Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('A browser test passphrase!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My installations' })).toBeVisible();
  await expect(page.getByText('No installations yet.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Add installation' }).click();
  await page.getByLabel('Installation name').fill('Test rooftop');
  await page.getByLabel('Location').fill('Austin, TX');
  await page.getByLabel('Installed capacity (kW)').fill('7.125');
  await page.getByRole('button', { name: 'Save installation' }).click();
  await expect(page.getByRole('heading', { name: 'Test rooftop' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Test rooftop' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Installation name').fill('Updated rooftop');
  await page.getByRole('button', { name: 'Save installation' }).click();
  await expect(page.getByRole('heading', { name: 'Updated rooftop' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL('/login');
  await page.goto('/sites');
  await expect(page).toHaveURL('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('A browser test passphrase!');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Updated rooftop' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('No installations yet.', { exact: false })).toBeVisible();
});
