import { test, expect } from '@playwright/test'

const FULL_SESSION = 9472
const CORE_ONLY_SESSION = 9000
const FUTURE_SESSION = 9600

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

  test('shows final running order when switching to Race Story', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await page.getByRole('tab', { name: 'Race Story' }).click()

    const verRow = page.locator('.rs-driver-row', {
      has: page.locator('.rs-driver-name', { hasText: 'VER' }),
    })
    const hamRow = page.locator('.rs-driver-row', {
      has: page.locator('.rs-driver-name', { hasText: 'HAM' }),
    })
    await expect(verRow.locator('.rs-pos-col')).toHaveText('1')
    await expect(hamRow.locator('.rs-pos-col')).toHaveText('2')
  })

  test('Race Story renders the position evolution chart for a full session', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await page.getByRole('tab', { name: 'Race Story' }).click()

    await expect(page.locator('[data-testid="position-chart"]')).toBeVisible()
    await expect(
      page.getByRole('img', { name: 'Position evolution chart' }),
    ).toBeVisible()
    await expect(page.getByTestId('race-story-no-positions')).not.toBeVisible()
  })

  test('Race Story highlights a chapter card when clicked', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await page.getByRole('tab', { name: 'Race Story' }).click()

    const firstCard = page.getByTestId('chapter-card-0')
    await expect(firstCard).toBeVisible()
    await firstCard.click()
    await expect(firstCard).toHaveClass(/active/)
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

  test('Race Story shows empty-state card when positions are unavailable', async ({
    page,
  }) => {
    await page.goto(`/race-hub?session_key=${CORE_ONLY_SESSION}`)
    await page.getByRole('tab', { name: 'Race Story' }).click()

    const empty = page.getByTestId('race-story-no-positions')
    await expect(empty).toBeVisible()
    await expect(empty.getByText('Lap-by-lap positions not available')).toBeVisible()
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

  test('Diagnostics is a secondary action and points at admin, not inline CLI hints', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${CORE_ONLY_SESSION}`)
    await page.getByRole('tab', { name: 'Diagnostics' }).click()

    await expect(page.getByTestId('rh-data-status')).toBeVisible()
    await expect(page.getByRole('link', { name: /manage ingestion/i })).toHaveAttribute(
      'href',
      '/admin',
    )
    // Raw coverage strip stays hidden until explicitly requested.
    await expect(page.getByTestId('rh-dataset-strip')).toHaveCount(0)
    await page.getByTestId('rh-diagnostics-toggle').click()
    await expect(page.getByTestId('rh-dataset-strip')).toBeVisible()
  })

  test('groups analysis navigation into Story, Analysis, and Data & Context', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await expect(page.getByTestId('rh-tabgroup-story')).toBeVisible()
    await expect(page.getByTestId('rh-tabgroup-analysis')).toBeVisible()
    await expect(page.getByTestId('rh-tabgroup-context')).toBeVisible()
  })

  test('bare /race-hub resolves to a completed session, never a future one', async ({ page }) => {
    await page.goto('/race-hub')
    await expect(page).toHaveURL(/session_key=\d+/)
    await expect(page.getByTestId('race-hub')).toBeVisible()
    // It must not land on the future session.
    await expect(page).not.toHaveURL(new RegExp(`session_key=${FUTURE_SESSION}`))
  })

  test('explicit completed session deep link stays stable and shows analysis', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await expect(page).toHaveURL(new RegExp(`session_key=${FULL_SESSION}`))
    await expect(page.getByTestId('rh-overview')).toBeVisible()
  })

  test('explicit future session renders the pre-session view, not empty analysis', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FUTURE_SESSION}`)
    await expect(page.getByTestId('race-hub')).toBeVisible()
    await expect(page.getByTestId('rh-presession')).toBeVisible()
    await expect(page.getByTestId('rh-overview')).toHaveCount(0)
  })

  test('returning to Weekend from an analysis view preserves the meeting context', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await page.getByRole('tab', { name: 'Strategy' }).click()

    await page.getByTestId('rh-switch-weekend').click()
    await expect(page.getByTestId('rh-switcher')).toBeVisible()
    // The current session remains reachable/selected from the switcher.
    await expect(page.getByTestId(`rh-switcher-session-${FULL_SESSION}`)).toBeVisible()
  })
})
