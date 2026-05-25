import { defineConfig, devices } from '@playwright/test'

const E2E_DB = '.playwright/boxbox-e2e.db'
const API_PORT = process.env.BOXBOX_API_PORT ?? '18080'
const WEB_PORT = process.env.BOXBOX_WEB_PORT ?? '15173'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `go run ./scripts/seed-e2e-db/main.go --db ${E2E_DB} && BOXBOX_DISABLE_LIVE=1 go run ./cmd/main.go --web --db ${E2E_DB} --port ${API_PORT}`,
      url: `http://localhost:${API_PORT}/api/v1/race-hub?session_key=9472`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `BOXBOX_API_PORT=${API_PORT} npm run dev --prefix frontend -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
