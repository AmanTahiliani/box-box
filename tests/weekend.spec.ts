import { test, expect, type Page } from '@playwright/test'

const FULL_SESSION = 9472

async function documentOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement
    return doc.scrollWidth - doc.clientWidth
  })
}

test.describe('Weekend home (seeded canonical context)', () => {
  test('renders the Weekend home from the canonical endpoint, not the limited fallback', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('weekend-page')).toBeVisible()
    // The seeded DB (Monaco 2025, completed) resolves to season_complete, driven
    // by the canonical /api/v1/weekend-context endpoint.
    await expect(page.getByTestId('weekend-page')).toHaveAttribute('data-temporal-state', 'season_complete')
    await expect(page.getByTestId('weekend-between-races')).toBeVisible()
    await expect(page.getByTestId('weekend-limited')).toHaveCount(0)
    // No ingest/dataset terminology on the Weekend surface.
    await expect(page.getByText(/ingest/i)).toHaveCount(0)
  })

  test('the completed-event CTA opens the canonical analysis session in Race Hub', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('wk-last-event')).toBeVisible()
    await page.getByTestId('wk-explore-race-story').click()
    await expect(page).toHaveURL(/\/race-hub\?session_key=\d+/)
    await expect(page.getByTestId('race-hub')).toBeVisible()
  })

  test('/preview alias resolves without looping back to the same screen', async ({ page }) => {
    await page.goto('/preview')
    // In the seeded season-complete state there is no next event, so /preview
    // resolves to the Weekend home rather than a redirect loop.
    await expect(page.getByTestId('weekend-page')).toBeVisible()
    await expect(page).toHaveURL(/\/preview$/)
  })

  test('existing deep-link routes remain valid', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await expect(page.getByTestId('race-hub')).toBeVisible()
    await expect(page.getByTestId('rh-overview')).toBeVisible()

    await page.goto('/admin')
    await expect(page.getByTestId('data-library')).toBeVisible()

    await page.goto('/live')
    await expect(page.getByTestId('live-empty')).toBeVisible()

    await page.goto('/explore')
    await expect(page.getByTestId('explore-page')).toBeVisible()
  })
})

test.describe('Weekend navigation hierarchy', () => {
  test('all four destinations are reachable from primary navigation', async ({ page }) => {
    await page.goto('/')
    const primary = page.getByRole('navigation', { name: 'Primary' }).first()
    for (const [label, url] of [
      ['Championship', /\/championship/],
      ['Briefing', /\/briefing/],
      ['Explore', /\/explore/],
      ['Weekend', /\/$/],
    ] as const) {
      await primary.getByRole('link', { name: label, exact: true }).click()
      await expect(page).toHaveURL(url)
    }
  })

  test('Admin is an operator utility outside the Primary landmark', async ({ page }) => {
    await page.goto('/')
    const primaries = page.getByRole('navigation', { name: 'Primary' })
    await expect(primaries.first()).toBeVisible()
    // Admin must not appear inside any Primary landmark.
    await expect(primaries.getByRole('link', { name: /Admin/i })).toHaveCount(0)
    await expect(
      page.getByRole('toolbar', { name: 'Operator utilities' }).getByRole('link', { name: 'Admin' }),
    ).toBeVisible()
  })
})

test.describe('Weekend responsive — no global horizontal overflow', () => {
  for (const { name, width, height } of [
    { name: 'mobile 390', width: 390, height: 844 },
    { name: 'tablet 768', width: 768, height: 1024 },
    { name: 'desktop 1440', width: 1440, height: 900 },
  ]) {
    test(`no document overflow at ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto('/')
      await expect(page.getByTestId('weekend-between-races')).toBeVisible()
      expect(await documentOverflow(page)).toBeLessThanOrEqual(1)
    })
  }

  test('mobile shows exactly one visible primary navigation (bottom bar)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByTestId('weekend-page')).toBeVisible()

    // The bottom bar is the single visible primary nav; the top bar's links are
    // hidden by CSS at this breakpoint.
    const bottom = page.locator('.app-bottom-nav')
    await expect(bottom).toBeVisible()
    await expect(bottom.getByRole('link')).toHaveCount(4)

    const topLinks = page.locator('.app-nav .nav-links')
    await expect(topLinks).toBeHidden()

    // All four destinations remain reachable via the bottom bar.
    for (const label of ['Weekend', 'Championship', 'Briefing', 'Explore']) {
      await expect(bottom.getByRole('link', { name: new RegExp(label) })).toBeVisible()
    }
  })
})
