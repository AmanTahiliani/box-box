import { expect, type Locator, type Page } from '@playwright/test'
import { FUTURE_SESSION, mockFutureRaceHubSession } from '../fixtures/future-session'

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const

export const FULL_SESSION = 9472
export { FUTURE_SESSION }

/** Wait for web fonts and layout to settle before screenshots. */
export async function waitForScreenshotReady(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(150)
}

export async function gotoWeekendReady(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('weekend-page')).toBeVisible()
  // The seeded hermetic DB (Monaco 2025, completed) resolves to season_complete,
  // rendered by the between-races surface.
  await expect(page.getByTestId('weekend-between-races')).toBeVisible()
  await expect(page.getByTestId('wk-last-event')).toBeVisible()
  await waitForScreenshotReady(page)
}

export async function gotoRaceHubReady(page: Page, sessionKey = FULL_SESSION): Promise<void> {
  await page.goto(`/race-hub?session_key=${sessionKey}`)
  await expect(page.getByTestId('race-hub')).toBeVisible()
  await expect(page.getByTestId('rh-identity')).toBeVisible()
  await expect(page.getByTestId(`rh-session-${sessionKey}`)).toBeVisible()
  await expect(page.getByTestId('rh-overview')).toBeVisible()
  await waitForScreenshotReady(page)
}

export async function gotoRaceHubFutureReady(
  page: Page,
  sessionKey = FUTURE_SESSION,
): Promise<void> {
  await mockFutureRaceHubSession(page)
  await page.goto(`/race-hub?session_key=${sessionKey}`)
  await expect(page.getByTestId('race-hub')).toBeVisible()
  await expect(page.getByTestId('rh-presession')).toBeVisible()
  await waitForScreenshotReady(page)
}

export async function gotoRaceStoryReady(page: Page, sessionKey = FULL_SESSION): Promise<void> {
  await page.goto(`/race-hub?session_key=${sessionKey}`)
  await expect(page.getByTestId('race-hub')).toBeVisible()
  await page.getByRole('tab', { name: 'Race Story' }).click()
  await expect(page.getByTestId('position-chart')).toBeVisible()
  await waitForScreenshotReady(page)
}

export async function gotoDataLibraryReady(page: Page): Promise<void> {
  await page.goto('/admin')
  await expect(page.getByTestId('data-library')).toBeVisible()
  await expect(page.getByTestId('dl-meeting-1229')).toBeVisible()
  await expect(page.getByTestId('meeting-detail')).toBeVisible()
  await waitForScreenshotReady(page)
}

export async function gotoLiveInactiveReady(page: Page): Promise<void> {
  await page.goto('/live')
  await expect(page.locator('.loading-state')).toHaveCount(0)
  // With BOXBOX_DISABLE_LIVE=1 the feed is silent, so the page settles into the
  // inactive weekend-context handoff sourced from /api/v1/weekend-context.
  await expect(page.getByTestId('live-inactive')).toBeVisible()
  await waitForScreenshotReady(page)
}

export async function screenshotPage(
  page: Page,
  name: string,
  options?: { mask?: Locator[] },
): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    mask: options?.mask,
  })
}
