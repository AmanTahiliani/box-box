import { test } from '@playwright/test'
import { gotoLiveActiveReady, screenshotPage } from './helpers'

test.describe('Live active visual regression', () => {
  test('live-active', async ({ page }) => {
    await gotoLiveActiveReady(page)
    await screenshotPage(page, 'live-active')
  })
})
