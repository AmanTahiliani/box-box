import { defineConfig } from '@playwright/test'
import { VIEWPORTS } from './tests/visual/helpers'

const E2E_DB = '.playwright/boxbox-e2e.db'
const API_PORT = process.env.BOXBOX_API_PORT ?? '18080'
const WEB_PORT = process.env.BOXBOX_WEB_PORT ?? '15173'

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  snapshotPathTemplate: '{testDir}/{testFileDir}/__snapshots__/{projectName}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
    colorScheme: 'dark',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        browserName: 'chromium',
        viewport: VIEWPORTS.desktop,
      },
    },
    {
      name: 'tablet',
      use: {
        browserName: 'chromium',
        viewport: VIEWPORTS.tablet,
      },
    },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: VIEWPORTS.mobile,
      },
    },
  ],
  webServer: [
    {
      // BOXBOX_OPENF1_BASE_URL points at an unreachable address so the visual stack
      // never depends on the live OpenF1 API (keeps runs hermetic + date-stable).
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
