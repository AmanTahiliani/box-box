import { test } from '@playwright/test'
import {
  gotoDataLibraryReady,
  gotoLiveEmptyReady,
  gotoRaceHubReady,
  screenshotPage,
} from './helpers'

test.describe('MVP visual regression', () => {
  test('race-hub', async ({ page }) => {
    await gotoRaceHubReady(page)
    await screenshotPage(page, 'race-hub')
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
