import { test, expect } from '@playwright/test'

const FULL_SESSION = 9472

test.describe('Command Center', () => {
  test('loads as default route with local coverage summary', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('command-center')).toBeVisible()
    await expect(page.getByText('Command Center')).toBeVisible()
    await expect(page.getByTestId('cc-focus')).toBeVisible()
    await expect(page.getByTestId('cc-session-9472')).toBeVisible()
  })

  test('nav link reaches command center from race hub', async ({ page }) => {
    await page.goto('/race-hub')
    await page.getByRole('link', { name: 'Command' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('command-center')).toBeVisible()
  })

  test('quick action opens race hub for default session', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('cc-action-race-hub')).toContainText(String(FULL_SESSION))
    await page.getByTestId('cc-action-race-hub').click()
    await expect(page).toHaveURL(new RegExp(`/race-hub\\?session_key=${FULL_SESSION}`))
    await expect(page.getByText('Final Classification')).toBeVisible()
  })

  test('existing routes continue to work', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await expect(page.getByText('Final Classification')).toBeVisible()

    await page.goto('/data-library')
    await expect(page.getByTestId('data-library')).toBeVisible()

    await page.goto('/live')
    await expect(page.getByTestId('live-empty')).toBeVisible()
  })
})
