import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 }
  },

  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts',
      use: {
        launchOptions: {
          args: [],
          executablePath: require('electron').toString(),
        },
        contextOptions: {
          ignoreHTTPSErrors: true,
        }
      }
    }
  ]
});