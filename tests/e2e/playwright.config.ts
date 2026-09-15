import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // This config lives in `tests/e2e/`, and `testDir` is resolved relative to it,
  // so the specs sit next to it. The previous value (`./tests/e2e`) resolved to
  // `tests/e2e/tests/e2e`, which does not exist: Playwright found no tests at
  // all.
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  // Playwright owns the web server in CI as well as locally. Leaving it
  // `undefined` under CI required some other job to have started the app on
  // :3000, which nothing did — the suite could not run at all. `reuseExistingServer`
  // still lets a developer keep their own dev server running.
  webServer: {
    command: 'pnpm --filter @epay/web dev',
    // Two levels up from `tests/e2e`: the workspace root, which is where
    // `pnpm --filter` has to run.
    cwd: '../..',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
