import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90000,
  expect: { timeout: 15000 },
  retries: 1,
  // Run tests sequentially to avoid blank window issues
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    headless: true,
    // Fix for blank windows - explicit viewport and launch options
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
    },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    // Wait for network idle before considering page loaded
    navigationTimeout: 30000,
  },
  projects: [
    // Primary - Chromium only for faster testing (run others explicitly)
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Optional cross-browser (run with --project=firefox etc)
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
    { name: 'tablet', use: { ...devices['iPad Pro 11'] } },
  ],
  webServer: {
    command: 'npm run dev -- -p 3000',
    port: 3000,
    reuseExistingServer: true,
    timeout: 120000,
  },
})
