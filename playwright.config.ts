import { defineConfig, devices } from '@playwright/test'

const isCi = process.env.CI !== undefined

export default defineConfig({
  testDir: './tests/acceptance',
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:client',
      url: 'http://localhost:3000',
      reuseExistingServer: !isCi,
    },
    {
      command: 'npm run dev:server',
      url: 'http://localhost:4000/health/live',
      reuseExistingServer: !isCi,
    },
  ],
})
