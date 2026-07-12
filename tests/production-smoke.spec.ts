import { test, expect } from '@playwright/test'

const FULL_SESSION = 9472

test.describe('Production serving (Go + built React)', () => {
  test('serves the Weekend home as default route', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('weekend-page')).toBeVisible()
    await expect(page.getByTestId('weekend-between-races')).toBeVisible()
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

  test('serves live route with the inactive handoff when live is disabled', async ({ page }) => {
    await page.goto('/live')

    await expect(page.getByTestId('live-inactive')).toBeVisible()
    await expect(page.getByText('NO LIVE SESSION')).toBeVisible()
  })

  test('primary nav links and Admin utility work from built SPA', async ({ page }) => {
    await page.goto('/')
    const primary = page.getByRole('navigation', { name: 'Primary' }).first()

    await primary.getByRole('link', { name: 'Championship', exact: true }).click()
    await expect(page).toHaveURL(/\/championship/)

    await primary.getByRole('link', { name: 'Explore', exact: true }).click()
    await expect(page).toHaveURL(/\/explore/)

    await primary.getByRole('link', { name: 'Weekend', exact: true }).click()
    await expect(page).toHaveURL('/')

    // Admin is an operator utility outside the Primary landmark.
    await page.getByRole('toolbar', { name: 'Operator utilities' }).getByRole('link', { name: 'Admin' }).click()
    await expect(page).toHaveURL(/\/admin/)
  })
})
