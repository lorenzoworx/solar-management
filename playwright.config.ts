import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

const envFile = new URL('./.env', import.meta.url);
if (existsSync(envFile)) loadEnvFile(envFile);
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/solar_management_test') {
  throw new Error('Browser tests require the dedicated solar_management_test database.');
}

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5175',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run db:migrate && npm run db:seed && npm run dev',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
    timeout: 30_000,
    env: { API_PORT: '3001', DATABASE_URL: databaseUrl, APP_ORIGIN: 'http://127.0.0.1:5175' },
  },
});
