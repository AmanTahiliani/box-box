import { expect, type Locator, type Page } from '@playwright/test'

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const

export const FULL_SESSION = 9472

async function routeSeededSeasonCalendar(page: Page): Promise<void> {
  await page.route(/\/api\/v1\/meetings(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('year') !== '2025' || url.searchParams.get('source') !== 'openf1') {
      await route.continue()
      return
    }

    url.searchParams.set('source', 'local')
    const response = await route.fetch({ url: url.toString() })
    await route.fulfill({ response })
  })
}

/** Wait for web fonts and layout to settle before screenshots. */
export async function waitForScreenshotReady(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(150)
}

export async function gotoCommandCenterReady(page: Page): Promise<void> {
  await routeSeededSeasonCalendar(page)
  await page.goto('/')
  await expect(page.getByTestId('command-center')).toBeVisible()
  await expect(page.getByTestId('cc-focus')).toBeVisible()
  await expect(page.getByTestId('cc-calendar-1229')).toBeVisible({ timeout: 15_000 })
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

export async function gotoLiveEmptyReady(page: Page): Promise<void> {
  await page.goto('/live')
  await expect(page.locator('.loading-state')).toHaveCount(0)
  await expect(page.getByTestId('live-empty')).toBeVisible()
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
