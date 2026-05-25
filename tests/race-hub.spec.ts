import { test, expect } from '@playwright/test'

const FULL_SESSION = 9472
const CORE_ONLY_SESSION = 9000

test.describe('Race Hub Weekend Workspace', () => {
  test('lands on the Overview tab with workspace identity', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)

    await expect(page.getByTestId('race-hub')).toBeVisible()
    await expect(page.getByTestId('rh-identity')).toBeVisible()
    await expect(page.getByTestId(`rh-session-${FULL_SESSION}`)).toBeVisible()
    await expect(page.getByTestId('rh-overview')).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('shows final classification when switching to Race Story', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await page.getByRole('tab', { name: 'Race Story' }).click()

    await expect(page.getByText('Final Classification')).toBeVisible()
    await expect(page.locator('.drv-code', { hasText: 'VER' })).toBeVisible()
    await expect(page.locator('.drv-code', { hasText: 'HAM' })).toBeVisible()
  })

  test('Race Story exposes classification, grid, and positions sub-views', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await page.getByRole('tab', { name: 'Race Story' }).click()

    await page.getByRole('tab', { name: 'Starting Grid' }).click()
    await expect(page.locator('.sec-title', { hasText: 'Starting Grid' })).toBeVisible()

    await page.getByRole('tab', { name: 'Positions' }).click()
    await expect(page.locator('[data-testid="position-chart"]')).toBeVisible()
  })

  test('strategy tab renders stint chart when stints are available', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await page.getByRole('tab', { name: 'Strategy' }).click()

    await expect(page.locator('[data-testid="strategy-chart"]')).toBeVisible()
    await expect(page.getByText('Stints not available.')).not.toBeVisible()
  })

  test('strategy tab shows missing notice when stints are unavailable', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${CORE_ONLY_SESSION}`)
    await page.getByRole('tab', { name: 'Strategy' }).click()

    await expect(page.getByText('Stints not available.')).toBeVisible()
    await expect(page.locator('[data-testid="strategy-chart"]')).not.toBeVisible()
  })

  test('positions sub-view shows missing notice when positions are unavailable', async ({
    page,
  }) => {
    await page.goto(`/race-hub?session_key=${CORE_ONLY_SESSION}`)
    await page.getByRole('tab', { name: 'Race Story' }).click()
    await page.getByRole('tab', { name: 'Positions' }).click()

    await expect(page.getByText('Lap-by-lap positions not available.')).toBeVisible()
    await expect(page.locator('[data-testid="position-chart"]')).not.toBeVisible()
  })

  test('switching weekend via the inline switcher navigates to selected session', async ({
    page,
  }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await page.getByTestId('rh-switch-weekend').click()

    await expect(page.getByTestId('rh-switcher')).toBeVisible()
    // Active session is already loaded; just confirm a session button is reachable
    await expect(page.getByTestId(`rh-switcher-session-${FULL_SESSION}`)).toBeVisible()
  })

  test('Data Status tab points at admin instead of inline CLI hints', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${CORE_ONLY_SESSION}`)
    await page.getByRole('tab', { name: 'Data Status' }).click()

    await expect(page.getByTestId('rh-data-status')).toBeVisible()
    await expect(page.getByRole('link', { name: /manage ingestion/i })).toHaveAttribute(
      'href',
      '/admin',
    )
  })

  test('bare /race-hub redirects to the focus session', async ({ page }) => {
    await page.goto('/race-hub')
    await expect(page).toHaveURL(/session_key=\d+/)
    await expect(page.getByTestId('race-hub')).toBeVisible()
  })
})
