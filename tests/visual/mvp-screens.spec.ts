import { test } from '@playwright/test'
import {
  gotoWeekendReady,
  gotoDataLibraryReady,
  gotoLiveEmptyReady,
  gotoRaceHubFutureReady,
  gotoRaceHubReady,
  screenshotPage,
} from './helpers'

test.describe('MVP visual regression', () => {
  test('weekend', async ({ page }) => {
    await gotoWeekendReady(page)
    await screenshotPage(page, 'weekend')
  })

  test('race-hub', async ({ page }) => {
    await gotoRaceHubReady(page)
    await screenshotPage(page, 'race-hub')
  })

  test('race-hub-future', async ({ page }) => {
    await gotoRaceHubFutureReady(page)
    // The countdown ticks every second — mask it so the snapshot stays stable.
    await screenshotPage(page, 'race-hub-future', {
      mask: [page.getByTestId('rh-presession-countdown')],
    })
  })

  test('data-library', async ({ page }) => {
    await gotoDataLibraryReady(page)
    await screenshotPage(page, 'data-library')
  })

  test('live-empty', async ({ page }) => {
    await gotoLiveEmptyReady(page)
    await screenshotPage(page, 'live')
  })
})
