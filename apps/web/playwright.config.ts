import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke tests against the running local stack (Supabase + API + web):
 *   npm run dev            # in another terminal (or let `webServer` start it)
 *   npm run test:ui --workspace @my-movie-catalog/web
 * Uses the installed Google Chrome; run `npx playwright install chromium` and drop `channel`
 * to use Playwright's own browser instead.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: 'npm run dev --prefix ../..',
    url: 'http://localhost:3000/sign-in',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
