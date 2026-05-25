import { test, expect } from '@playwright/test'

const FULL_SESSION = 9472

test.describe('Admin · Data Health', () => {
  test('shows local coverage and ingest commands at /admin', async ({ page }) => {
    await page.goto('/admin')

    await expect(page.getByTestId('data-library')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Data Health' })).toBeVisible()
    await expect(page.getByTestId('dl-meeting-1229')).toBeVisible()
    await expect(page.getByTestId('meeting-detail')).toBeVisible()
    await expect(page.getByTestId('cli-commands').first()).toBeVisible()
    await expect(page.getByText('box-box --ingest-meeting 1229', { exact: true })).toBeVisible()
    await expect(page.getByText('box-box --ingest-session 9472', { exact: true })).toBeVisible()
  })

  test('legacy /data-library route still renders the same page', async ({ page }) => {
    await page.goto('/data-library')
    await expect(page.getByTestId('data-library')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Data Health' })).toBeVisible()
    await expect(page.getByTestId('dl-meeting-1229')).toBeVisible()
  })

  test('admin nav link reaches data health from race hub', async ({ page }) => {
    await page.goto('/race-hub')
    await page.getByRole('link', { name: 'Admin', exact: true }).click()
    await expect(page).toHaveURL(/\/admin/)
    await expect(page.getByTestId('data-library')).toBeVisible()
  })

  test('race hub link from data health footer works', async ({ page }) => {
    await page.goto('/admin')
    await page.getByRole('link', { name: /Open Race Hub/i }).click()
    await expect(page).toHaveURL(/\/race-hub/)
  })

  test('direct race hub session link still works', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await expect(page.getByText('Final Classification')).toBeVisible()
  })
})
