import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for MediCore Hospital Management System.
 *
 * Prerequisites — both dev servers must be running before running tests:
 *   cd server && npm run dev   (port 5000)
 *   cd client && npm run dev   (port 5173)
 *
 * Run tests:
 *   cd e2e && npx playwright install chromium && npm test
 */
export default defineConfig({
  testDir: './tests',

  // Run tests sequentially to avoid conflicts on the shared development DB
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['line'],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',

    // Retain trace/screenshot/video only on failure to keep disk usage low
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Generous timeout for pages that load chart data
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
