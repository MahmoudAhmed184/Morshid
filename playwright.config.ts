import { defineConfig, devices } from '@playwright/test'

const isCi = process.env.CI !== undefined
const clientPort = parsePort(
  process.env.PLAYWRIGHT_CLIENT_PORT,
  3000,
  'PLAYWRIGHT_CLIENT_PORT',
)
const serverPort = parsePort(
  process.env.PLAYWRIGHT_SERVER_PORT,
  4000,
  'PLAYWRIGHT_SERVER_PORT',
)
const clientBaseUrl = `http://127.0.0.1:${clientPort.toString()}`
const serverBaseUrl = `http://127.0.0.1:${serverPort.toString()}`

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
      command: `env VITE_API_BASE_URL=${serverBaseUrl} npm exec --workspace client -- vite dev --host 127.0.0.1 --port ${clientPort.toString()} --strictPort`,
      url: clientBaseUrl,
      reuseExistingServer: !isCi,
      timeout: 180_000,
    },
    {
      command: `env PORT=${serverPort.toString()} CLIENT_ORIGIN=${clientBaseUrl} ANALYSIS_MODEL_PROVIDER=deterministic TUTOR_MODEL_PROVIDER=deterministic SEMANTIC_GUARD_PROVIDER=deterministic EMBEDDING_PROVIDER=deterministic GEMINI_CHAT_PROJECTS_JSON='[]' RETRIEVAL_MIN_SIMILARITY=0 npm run dev:server`,
      url: `${serverBaseUrl}/health/live`,
      reuseExistingServer: !isCi,
      timeout: 180_000,
    },
  ],
})

function parsePort(value: string | undefined, fallback: number, name: string) {
  const port = value === undefined ? fallback : Number(value)

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be a valid TCP port`)
  }

  return port
}
