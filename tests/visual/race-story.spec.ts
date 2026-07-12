import { test } from '@playwright/test'
import { gotoRaceStoryReady, screenshotPage } from './helpers'

test.describe('Race Story visual regression', () => {
  test('race-story', async ({ page }) => {
    await gotoRaceStoryReady(page)
    await screenshotPage(page, 'race-story')
  })
})
