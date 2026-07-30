import { defineConfig } from '@playwright/test'
import { VIEWPORTS } from './tests/visual/helpers'

const E2E_DB = '.playwright/boxbox-fidelity.db'
const API_PORT = process.env.BOXBOX_API_PORT ?? '18080'
const WEB_PORT = process.env.BOXBOX_WEB_PORT ?? '15173'

// Candidate captures are evidence for owner review, not regression baselines.
export default defineConfig({
  testDir: './tests/release-fidelity',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    colorScheme: 'dark',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: VIEWPORTS.desktop } },
    { name: 'mobile', use: { browserName: 'chromium', viewport: VIEWPORTS.mobile } },
  ],
  webServer: [
    {
      command: `go run ./scripts/seed-e2e-db/main.go --db ${E2E_DB} && BOXBOX_DISABLE_LIVE=1 BOXBOX_OPENF1_BASE_URL=http://127.0.0.1:9 go run ./cmd/main.go --web --db ${E2E_DB} --port ${API_PORT}`,
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
