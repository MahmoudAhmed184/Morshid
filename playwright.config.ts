import { defineConfig, devices } from '@playwright/test'

const isCi = process.env.CI !== undefined
const clientPort = parsePort(process.env.PLAYWRIGHT_CLIENT_PORT, 3000)
const clientBaseUrl = `http://localhost:${clientPort.toString()}`

export default defineConfig({
  testDir: './tests/acceptance',
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: clientBaseUrl,
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
      command: `npm exec --workspace client -- vite dev --port ${clientPort.toString()} --strictPort`,
      url: clientBaseUrl,
      reuseExistingServer: !isCi,
    },
    {
      command: `env CLIENT_ORIGIN=${clientBaseUrl} npm run dev:server`,
      url: 'http://localhost:4000/health/live',
      reuseExistingServer: !isCi,
      timeout: 180_000,
    },
  ],
})

function parsePort(value: string | undefined, fallback: number) {
  const port = value === undefined ? fallback : Number(value)

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PLAYWRIGHT_CLIENT_PORT must be a valid TCP port')
  }

  return port
}
