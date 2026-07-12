import { test, expect, type Page } from '@playwright/test'

// These journeys inject the canonical /api/v1/weekend-context payload directly so
// each temporal state is exercised deterministically and hermetically, regardless
// of the seeded database clock. The payloads mirror internal/query.WeekendContext.

const availability = {
  schedule: 'available',
  live_transport: 'unknown',
  live_session: 'inactive',
  archive: 'unavailable',
  local_analysis: 'complete',
  freshness: 'fresh',
  limitations: [],
}

function meeting(key: number, name: string, start: string) {
  return {
    meeting_key: key,
    meeting_name: name,
    meeting_official_name: name,
    location: name,
    country_code: 'GBR',
    country_name: 'United Kingdom',
    country_flag: '',
    circuit_key: key,
    circuit_short_name: name,
    date_start: start,
    date_end: start,
    year: 2026,
  }
}

function ctxSession(key: number, name: string, start: string, meetingKey: number) {
  return {
    session: {
      session_key: key,
      session_name: name,
      session_type: name,
      meeting_key: meetingKey,
      date_start: start,
      date_end: start,
      gmt_offset: '',
    },
    meeting: meeting(meetingKey, 'British Grand Prix', start),
    availability,
  }
}

async function stubContext(page: Page, body: Record<string, unknown>): Promise<void> {
  await page.route('**/api/v1/weekend-context', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) }),
  )
  // Keep supplementary reads hermetic and empty.
  await page.route('**/api/v1/news**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  )
}

test.describe('Weekend canonical temporal states (injected)', () => {
  test('between_weekends pairs the last completed event with the next-event countdown and Prepare CTA', async ({ page }) => {
    await stubContext(page, {
      season: 2026,
      temporal_state: 'between_weekends',
      previous_meeting: meeting(1, 'British Grand Prix', '2026-07-05T14:00:00Z'),
      previous_completed_session: ctxSession(11, 'Race', '2026-07-05T14:00:00Z', 1),
      default_analysis_session: ctxSession(11, 'Race', '2026-07-05T14:00:00Z', 1),
      next_meeting: meeting(2, 'Hungarian Grand Prix', '2026-07-24T09:00:00Z'),
      next_session: ctxSession(21, 'Practice 1', '2026-07-24T09:00:00Z', 2),
      focus_meeting: meeting(2, 'Hungarian Grand Prix', '2026-07-24T09:00:00Z'),
      championship_round: 12,
      total_championship_rounds: 24,
    })

    await page.goto('/')
    await expect(page.getByTestId('weekend-between-races')).toBeVisible()
    await expect(page.getByTestId('wk-last-event')).toBeVisible()
    await expect(page.getByTestId('wk-next-event')).toBeVisible()
    await expect(page.getByTestId('wk-prepare')).toHaveAttribute('href', '/preview')
    await expect(page.getByTestId('wk-season-nav')).toContainText('Round 12 of 24')
  })

  test('between_races Prepare CTA folds into the preparation surface instead of looping', async ({ page }) => {
    await stubContext(page, {
      season: 2026,
      temporal_state: 'between_weekends',
      next_meeting: meeting(2, 'Hungarian Grand Prix', '2026-07-24T09:00:00Z'),
      next_session: ctxSession(21, 'Practice 1', '2026-07-24T09:00:00Z', 2),
      championship_round: 12,
      total_championship_rounds: 24,
    })

    await page.goto('/')
    await page.getByTestId('wk-prepare').click()
    await expect(page).toHaveURL(/\/preview$/)
    await expect(page.getByTestId('weekend-pre-session')).toBeVisible()
    await expect(page.getByTestId('weekend-between-races')).toHaveCount(0)
  })

  test('pre_session surfaces the preview and the next-session countdown', async ({ page }) => {
    await stubContext(page, {
      season: 2026,
      temporal_state: 'pre_session',
      next_meeting: meeting(2, 'Hungarian Grand Prix', '2026-07-24T09:00:00Z'),
      next_session: ctxSession(21, 'Practice 1', '2026-07-24T09:00:00Z', 2),
      focus_meeting: meeting(2, 'Hungarian Grand Prix', '2026-07-24T09:00:00Z'),
      championship_round: 12,
      total_championship_rounds: 24,
    })

    await page.goto('/')
    await expect(page.getByTestId('weekend-pre-session')).toBeVisible()
    await expect(page.getByTestId('wk-pre-head')).toBeVisible()
  })

  test('between_sessions shows the last result recap and the next-session countdown together', async ({ page }) => {
    await stubContext(page, {
      season: 2026,
      temporal_state: 'between_sessions',
      focus_meeting: meeting(1, 'British Grand Prix', '2026-07-04T10:00:00Z'),
      previous_completed_session: ctxSession(11, 'Sprint', '2026-07-04T10:00:00Z', 1),
      default_analysis_session: ctxSession(11, 'Sprint', '2026-07-04T10:00:00Z', 1),
      next_session: ctxSession(12, 'Race', '2026-07-05T14:00:00Z', 1),
      championship_round: 12,
      total_championship_rounds: 24,
    })

    await page.goto('/')
    await expect(page.getByTestId('weekend-between-sessions')).toBeVisible()
    await expect(page.getByTestId('wk-last-session')).toBeVisible()
    await expect(page.getByTestId('wk-next-session')).toBeVisible()
  })

  test('session_live hands off to live timing', async ({ page }) => {
    await stubContext(page, {
      season: 2026,
      temporal_state: 'session_live',
      focus_meeting: meeting(1, 'British Grand Prix', '2026-07-05T14:00:00Z'),
      active_session: ctxSession(11, 'Race', '2026-07-05T14:00:00Z', 1),
      championship_round: 12,
      total_championship_rounds: 24,
    })

    await page.goto('/')
    await expect(page.getByTestId('weekend-live')).toBeVisible()
    await expect(page.getByTestId('wk-watch-live')).toHaveAttribute('href', '/live')
  })

  test('an error from the canonical endpoint shows an explicit error surface', async ({ page }) => {
    await page.route('**/api/v1/weekend-context', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }),
    )
    await page.goto('/')
    await expect(page.getByTestId('weekend-error')).toBeVisible()
  })
})
