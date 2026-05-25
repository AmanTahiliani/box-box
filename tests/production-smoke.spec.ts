import { test, expect } from '@playwright/test'

const FULL_SESSION = 9472

test.describe('Production serving (Go + built React)', () => {
  test('serves command center as default route', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('command-center')).toBeVisible()
    await expect(page.getByTestId('cc-session-9472')).toBeVisible()
  })

  test('serves race hub workspace from built assets', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)

    await expect(page.getByTestId('race-hub')).toBeVisible()
    await expect(page.getByTestId('rh-identity')).toBeVisible()
    await expect(page.getByTestId(`rh-session-${FULL_SESSION}`)).toBeVisible()

    await page.getByRole('tab', { name: 'Race Story' }).click()
    await expect(page.getByText('Final Classification')).toBeVisible()
    await expect(page.locator('.drv-code', { hasText: 'VER' })).toBeVisible()
  })

  test('serves admin / data health route', async ({ page }) => {
    await page.goto('/admin')

    await expect(page.getByTestId('data-library')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Data Health' })).toBeVisible()
    await expect(page.getByTestId('dl-meeting-1229')).toBeVisible()
  })

  test('legacy /data-library route still works', async ({ page }) => {
    await page.goto('/data-library')

    await expect(page.getByTestId('data-library')).toBeVisible()
    await expect(page.getByTestId('dl-meeting-1229')).toBeVisible()
  })

  test('serves live route with empty state when live is disabled', async ({ page }) => {
    await page.goto('/live')

    await expect(page.getByTestId('live-empty')).toBeVisible()
    await expect(page.getByText('No live session active')).toBeVisible()
  })

  test('nav links work from built SPA', async ({ page }) => {
    await page.goto('/')
    await page.locator('.app-nav').getByRole('link', { name: 'Race Hub' }).click()
    await expect(page).toHaveURL(/\/race-hub/)

    await page.locator('.app-nav').getByRole('link', { name: 'Admin', exact: true }).click()
    await expect(page).toHaveURL(/\/admin/)

    await page.getByRole('link', { name: 'Live', exact: true }).click()
    await expect(page).toHaveURL(/\/live/)
    await expect(page.getByTestId('live-empty')).toBeVisible()
  })
})
