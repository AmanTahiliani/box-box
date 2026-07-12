import { test, expect } from '@playwright/test'

test.describe('Primary-route resilience (forced errors)', () => {
  test('Weekend leaves loading and shows retry after weekend-context failure', async ({
    page,
  }) => {
    await page.route('**/api/v1/weekend-context', async (route) => {
      await new Promise((r) => setTimeout(r, 50))
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'forced weekend-context failure', stale: false }),
      })
    })

    await page.goto('/')
    await expect(page.getByTestId('weekend-error')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
    await expect(page.getByTestId('weekend-error')).not.toHaveText(/API 503|forced weekend-context/i)
  })

  test('Driver Profile leaves loading and shows retry after summary timeout', async ({ page }) => {
    await page.route('**/api/v1/driver/summary**', async (route) => {
      // Hold the connection past the UI wait without fulfilling — the browser
      // abort/timeout path is covered in unit tests; here we force an HTTP error
      // so the shared RouteState recovery UI is exercised hermetically.
      await route.fulfill({
        status: 504,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'forced timeout', stale: false }),
      })
    })
    await page.route('**/api/v1/seasons', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([2025]) }),
    )

    await page.goto('/drivers/1?year=2025')
    await expect(page.getByTestId('driver-profile-error')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
    await expect(page.getByTestId('driver-profile-error')).not.toHaveText(/API 504/i)
  })
})
