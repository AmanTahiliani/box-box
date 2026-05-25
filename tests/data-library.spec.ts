import { test, expect } from '@playwright/test'

const FULL_SESSION = 9472

test.describe('Data Library', () => {
  test('shows local coverage and ingest commands', async ({ page }) => {
    await page.goto('/data-library')

    await expect(page.getByTestId('data-library')).toBeVisible()
    await expect(page.getByTestId('dl-meeting-1229')).toBeVisible()
    await expect(page.getByTestId('meeting-detail')).toBeVisible()
    await expect(page.getByTestId('cli-commands').first()).toBeVisible()
    await expect(page.getByText('box-box --ingest-meeting 1229', { exact: true })).toBeVisible()
    await expect(page.getByText('box-box --ingest-session 9472', { exact: true })).toBeVisible()
  })

  test('nav link reaches data library from race hub', async ({ page }) => {
    await page.goto('/race-hub')
    await page.getByRole('link', { name: 'Data Library' }).click()
    await expect(page).toHaveURL(/\/data-library/)
    await expect(page.getByTestId('data-library')).toBeVisible()
  })

  test('race hub link from data library footer works', async ({ page }) => {
    await page.goto('/data-library')
    await page.getByRole('link', { name: /Open Race Hub/i }).click()
    await expect(page).toHaveURL(/\/race-hub/)
  })

  test('direct race hub session link still works', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await expect(page.getByText('Final Classification')).toBeVisible()
  })
})
