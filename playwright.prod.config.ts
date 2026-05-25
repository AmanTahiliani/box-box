import { defineConfig, devices } from '@playwright/test'

const E2E_DB = '.playwright/boxbox-prod-e2e.db'
const PROD_PORT = process.env.BOXBOX_PROD_PORT ?? '18080'

export default defineConfig({
  testDir: './tests',
  testMatch: 'production-smoke.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: `http://localhost:${PROD_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run build --prefix frontend && go run ./scripts/seed-e2e-db/main.go --db ${E2E_DB} && BOXBOX_DISABLE_LIVE=1 go run ./cmd/main.go --web --db ${E2E_DB} --port ${PROD_PORT}`,
    url: `http://localhost:${PROD_PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
