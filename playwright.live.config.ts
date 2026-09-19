import { defineConfig, devices } from '@playwright/test';

const target = new URL(process.env.LIVE_BASE_URL ?? 'https://boywithabot.com/projects/solar-management/');
if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash ||
  !/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(target.pathname)) {
  throw new Error('LIVE_BASE_URL must be an HTTPS app URL ending in /, without credentials, query, or fragment.');
}
process.env.APP_BASE_PATH = target.pathname;

// Uses a real deployment: no local servers, database resets, or container operations.
// The account scenario creates one test account, deletes its site, and logs out.
export default defineConfig({
  testDir: './e2e', forbidOnly: true, retries: 0, workers: 1, timeout: 45000,
  reporter: 'list', expect: { timeout: 10000 },
  use: { baseURL: target.origin, ignoreHTTPSErrors: false, trace: 'off', screenshot: 'only-on-failure' },
  projects: [{ name: 'live-chromium', use: { ...devices['Desktop Chrome'] } }],
});
