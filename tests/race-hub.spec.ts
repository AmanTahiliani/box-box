import { test, expect } from '@playwright/test'

const FULL_SESSION = 9472
const CORE_ONLY_SESSION = 9000

test.describe('Race Hub', () => {
  test('loads classification for a seeded session', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)

    await expect(page.getByText('Final Classification')).toBeVisible()
    await expect(page.locator('.drv-code', { hasText: 'VER' })).toBeVisible()
    await expect(page.locator('.drv-code', { hasText: 'HAM' })).toBeVisible()
  })

  test('strategy tab renders stint chart when stints are available', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await page.getByRole('tab', { name: 'Strategy' }).click()

    await expect(page.locator('[data-testid="strategy-chart"]')).toBeVisible()
    await expect(page.getByText('Stints not available.')).not.toBeVisible()
  })

  test('positions tab renders position chart when positions are available', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await page.getByRole('tab', { name: 'Positions' }).click()

    await expect(page.locator('[data-testid="position-chart"]')).toBeVisible()
    await expect(page.getByText('Lap-by-lap positions not available.')).not.toBeVisible()
  })

  test('strategy tab shows missing notice when stints are unavailable', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${CORE_ONLY_SESSION}`)
    await page.getByRole('tab', { name: 'Strategy' }).click()

    await expect(page.getByText('Stints not available.')).toBeVisible()
    await expect(page.locator('[data-testid="strategy-chart"]')).not.toBeVisible()
  })

  test('positions tab shows missing notice when positions are unavailable', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${CORE_ONLY_SESSION}`)
    await page.getByRole('tab', { name: 'Positions' }).click()

    await expect(page.getByText('Lap-by-lap positions not available.')).toBeVisible()
    await expect(page.locator('[data-testid="position-chart"]')).not.toBeVisible()
  })
})
