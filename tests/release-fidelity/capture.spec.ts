import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { waitForScreenshotReady } from '../visual/helpers'

const version = process.env.RELEASE_FIDELITY_VERSION ?? 'v0.4.0'
const output = process.env.RELEASE_FIDELITY_OUTPUT ?? 'release-fidelity'
const activeLiveState = {
  is_live: true,
  data: {
    Drivers: {
      '1': { RacingNumber: '1', Position: 1, Interval: '' },
      '44': { RacingNumber: '44', Position: 2, Interval: '+2.314' },
    },
    DriverInfo: {
      '1': { RacingNumber: '1', Tla: 'VER', TeamColour: '3671C6' },
      '44': { RacingNumber: '44', Tla: 'HAM', TeamColour: 'E8002D' },
    },
    Tyres: {},
    RCMessages: [],
    Weather: {},
    Session: { MeetingName: 'Monaco', SessionName: 'Race', SessionType: 'Race' },
    TrackStatus: '1',
  },
}

async function capture(page: Page, name: string, project: string): Promise<void> {
  const directory = join(output, version, 'candidate', project)
  await mkdir(directory, { recursive: true })
  await page.screenshot({ fullPage: true, path: join(directory, `${name}.png`) })
}

async function useSeededCalendar(page: Page): Promise<void> {
  await page.route(/\/api\/v1\/meetings\?year=2025&source=openf1$/, (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  )
}

async function gotoCommandCenterFidelityReady(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('command-center')).toBeVisible()
  await expect(page.getByTestId('cc-focus')).toBeVisible()
  await expect(page.getByTestId('cc-calendar-1229')).toBeVisible()
  await page.waitForLoadState('networkidle')
  await waitForScreenshotReady(page)
}

test.describe('release-fidelity candidate captures', () => {
  test('approved screen set', async ({ page }, testInfo) => {
    const project = testInfo.project.name
    await useSeededCalendar(page)

    if (project === 'desktop') {
      await page.clock.install({ time: new Date('2025-06-01T12:00:00Z') })
      await gotoCommandCenterFidelityReady(page)
      await expect(page.getByTestId('hero-last-race')).toBeVisible()
      await capture(page, 'weekend-between-races', project)

      await page.route('**/api/v1/live/state', (route) =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(activeLiveState) }),
      )
      await page.clock.setFixedTime(new Date('2025-05-25T14:00:00Z'))
      await gotoCommandCenterFidelityReady(page)
      await expect(page.getByTestId('hero-live-timing')).toBeVisible()
      await capture(page, 'weekend-live', project)
    } else {
      await page.clock.install({ time: new Date('2025-05-25T12:00:00Z') })
      await gotoCommandCenterFidelityReady(page)
      await expect(page.getByTestId('hero-countdown')).toContainText('Next')
      await capture(page, 'weekend-between-sessions-mobile', project)
    }
  })
})
