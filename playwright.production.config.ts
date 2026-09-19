import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', forbidOnly: true, retries: 1, reporter: 'list',
  use: { baseURL: 'https://127.0.0.1:8443', ignoreHTTPSErrors: true, trace: 'retain-on-failure' },
  projects: [{ name: 'production-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/tls-test-proxy.mjs', url: 'https://127.0.0.1:8443',
    ignoreHTTPSErrors: true, reuseExistingServer: false, timeout: 30000,
  },
});
