import { test, expect } from '@playwright/test'

const FULL_SESSION = 9472
const CORE_ONLY_SESSION = 9000
const CONTEXT_MEETING = {
  meeting_key: 1229,
  meeting_name: 'Monaco',
  country_code: 'MON',
}
const CONTEXT_AVAILABILITY = {
  source: 'local', schedule: 'available', live_transport: 'unknown', live_session: 'inactive',
  archive: 'unavailable', local_analysis: 'complete', freshness: 'local', limitations: [],
}

function completedContext(refreshAt?: string) {
  return {
    temporal_state: 'between_weekends',
    race_hub_default_session: {
      session: { session_key: FULL_SESSION }, meeting: CONTEXT_MEETING, availability: CONTEXT_AVAILABILITY,
    },
    race_hub_pre_session: false,
    race_hub_refresh_at: refreshAt,
  }
}

function pendingContext(refreshAt: string) {
  return {
    temporal_state: 'pre_session',
    race_hub_default_session: {
      session: {
        session_key: 9473, meeting_key: 1229, session_name: 'Practice 1', session_type: 'Practice',
        date_start: '2030-01-01T00:00:01Z', date_end: '2030-01-01T01:00:01Z', gmt_offset: '00:00:00',
      },
      meeting: CONTEXT_MEETING,
      availability: { ...CONTEXT_AVAILABILITY, local_analysis: 'not_applicable' },
    },
    race_hub_pre_session: true,
    race_hub_refresh_at: refreshAt,
  }
}

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

  test('Data Status tab points at admin instead of inline CLI hints', async ({ page }) => {
    await page.goto(`/race-hub?session_key=${CORE_ONLY_SESSION}`)
    await page.getByRole('tab', { name: 'Data Status' }).click()

    await expect(page.getByTestId('rh-data-status')).toBeVisible()
    await expect(page.getByRole('link', { name: /manage ingestion/i })).toHaveAttribute(
      'href',
      '/admin',
    )
  })

  test('bare /race-hub shows server-selected completed analysis without changing the URL', async ({ page }) => {
    await page.route('**/api/v1/weekend-context', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(completedContext()) }),
    )
    await page.goto('/race-hub')
    await expect(page).toHaveURL(/\/race-hub$/)
    await expect(page.getByTestId('race-hub')).toBeVisible()
  })

  test('bare /race-hub hands off to pending pre-session state at the refresh deadline', async ({ page }) => {
    await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') })
    let requests = 0
    const raceHubRequests: number[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname === '/api/v1/race-hub') {
        raceHubRequests.push(Number(url.searchParams.get('session_key')))
      }
    })
    await page.route('**/api/v1/weekend-context', (route) => {
      requests += 1
      const body = requests === 1
        ? completedContext('2030-01-01T00:00:01Z')
        : pendingContext('2030-01-01T00:00:16Z')
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
    })

    await page.goto('/race-hub')
    await expect(page.getByTestId('race-hub')).toBeVisible()
    await page.clock.fastForward(1_000)

    await expect(page.getByTestId('race-hub-pre-session')).toBeVisible()
    await expect(page).toHaveURL(/\/race-hub$/)
    expect(raceHubRequests).toContain(FULL_SESSION)
    expect(raceHubRequests).not.toContain(9473)
  })

  test('bare /race-hub recovers when no completed local analysis exists', async ({ page }) => {
    await page.route('**/api/v1/weekend-context', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ temporal_state: 'between_weekends', race_hub_pre_session: false }),
      }),
    )

    await page.goto('/race-hub')
    await expect(page.getByTestId('race-hub-empty')).toContainText('No completed local analysis yet')
  })

  test('an explicit session URL remains stable when canonical context would refresh', async ({ page }) => {
    let contextRequested = false
    await page.route('**/api/v1/weekend-context', (route) => {
      contextRequested = true
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(pendingContext('2030-01-01T00:00:01Z')) })
    })

    await page.goto(`/race-hub?session_key=${FULL_SESSION}`)
    await expect(page.getByTestId('race-hub')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`session_key=${FULL_SESSION}`))
    expect(contextRequested).toBe(false)
  })
})
