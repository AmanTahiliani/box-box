import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'

const evidenceDir = path.join('tests', 'evidence', 'issue-76-availability')

const availability = {
  source: 'local',
  schedule: 'available',
  live_transport: 'unknown',
  live_session: 'inactive',
  archive: 'unavailable',
  local_analysis: 'partial',
  freshness: 'partial',
  limitations: [],
}

function meeting(key: number, name: string, start: string) {
  return {
    meeting_key: key,
    meeting_name: name,
    meeting_official_name: name,
    location: name,
    country_code: 'HUN',
    country_name: 'Hungary',
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
    meeting: meeting(meetingKey, 'Hungarian Grand Prix', start),
    availability,
  }
}

async function stubPreSession(page: Page, opts?: { failSessions?: boolean; recover?: boolean }) {
  const next = meeting(2, 'Hungarian Grand Prix', '2026-07-24T09:00:00Z')
  await page.route('**/api/v1/weekend-context', (route) =>
    route.fulfill({
      contentType: 'application/json',
      headers: {
        'X-BoxBox-Data-Source': 'local',
        'X-BoxBox-Data-Freshness': 'partial',
      },
      body: JSON.stringify({
        season: 2026,
        temporal_state: 'pre_session',
        focus_meeting: next,
        next_meeting: next,
        next_session: ctxSession(21, 'Practice 1', '2026-07-24T09:00:00Z', 2),
        championship_round: 13,
        total_championship_rounds: 24,
      }),
    }),
  )
  await page.route('**/api/v1/news**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/api/v1/championship/hub**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      headers: {
        'X-BoxBox-Data-Source': 'openf1',
        'X-BoxBox-Data-Freshness': 'stale',
      },
      body: JSON.stringify({
        season: 2026,
        round: 12,
        total_rounds: 24,
        rounds_left: 12,
        last_race: 'British GP',
        round_labels: [],
        drivers: [],
        teams: [],
      }),
    }),
  )

  let sessionCalls = 0
  await page.route('**/api/v1/sessions**', async (route) => {
    sessionCalls += 1
    if (opts?.failSessions && !(opts.recover && sessionCalls > 1)) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'API 500: forced sessions failure' }),
      })
      return
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          session_key: 21,
          session_name: 'Practice 1',
          session_type: 'Practice',
          meeting_key: 2,
          date_start: '2026-07-24T09:00:00Z',
          date_end: '2026-07-24T10:00:00Z',
          gmt_offset: '',
        },
      ]),
    })
  })

  await page.route('**/api/v1/meetings**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/api/v1/track-outline**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unavailable' }),
    }),
  )
}

test.describe('Issue #76 availability / Preview resilience evidence', () => {
  test('Weekend pre-session keeps shell usable on Preview supplement failure and recovers', async ({
    page,
  }, testInfo) => {
    await stubPreSession(page, { failSessions: true, recover: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    await expect(page.getByTestId('weekend-pre-session')).toBeVisible()
    await expect(page.getByTestId('wk-pre-head')).toContainText('Hungarian Grand Prix')
    await expect(page.getByTestId('weekend-data-notice')).toContainText(/Partial/i)
    await expect(page.getByTestId('preview-page')).toBeVisible()
    await expect(page.getByTestId('preview-page')).toHaveAttribute('data-meeting-key', '2')
    // No raw HTTP jargon in the primary Weekend child.
    await expect(page.locator('body')).not.toContainText(/API 500|forced sessions failure/i)

    await page.screenshot({
      path: path.join(evidenceDir, `weekend-presession-failure-mobile-${testInfo.project.name}.png`),
      fullPage: true,
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.screenshot({
      path: path.join(evidenceDir, `weekend-presession-partial-desktop-${testInfo.project.name}.png`),
      fullPage: true,
    })
  })

  test('Championship discloses stale metadata above usable standings', async ({ page }, testInfo) => {
    await page.route('**/api/v1/seasons', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([2026]) }),
    )
    await page.route('**/api/v1/championship/hub**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        headers: {
          'X-BoxBox-Data-Source': 'openf1',
          'X-BoxBox-Data-Freshness': 'stale',
        },
        body: JSON.stringify({
          season: 2026,
          round: 6,
          total_rounds: 24,
          rounds_left: 18,
          last_race: 'Monaco GP',
          round_labels: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'],
          drivers: [
            {
              driver_number: 1,
              name_acronym: 'VER',
              full_name: 'Max Verstappen',
              team_name: 'Red Bull',
              team_colour: '3671c6',
              points: 200,
              position: 1,
              wins: 5,
              podiums: 8,
              poles: 4,
              form: [25, 18, 25, 15, 25],
              cumulative: [25, 43, 68, 83, 108, 200],
              round_positions: [1, 2, 1, 3, 1, 1],
              teammate_wins: 9,
              teammate_losses: 1,
            },
            {
              driver_number: 4,
              name_acronym: 'NOR',
              full_name: 'Lando Norris',
              team_name: 'McLaren',
              team_colour: 'ff8000',
              points: 160,
              position: 2,
              wins: 3,
              podiums: 5,
              poles: 2,
              form: [18, 25, 18, 25, 18],
              cumulative: [18, 43, 61, 86, 104, 160],
              round_positions: [2, 1, 2, 2, 2, 2],
              teammate_wins: 6,
              teammate_losses: 4,
            },
          ],
          teams: [
            { team_name: 'Red Bull', team_colour: '3671c6', points: 260, position: 1, wins: 6 },
            { team_name: 'McLaren', team_colour: 'ff8000', points: 220, position: 2, wins: 3 },
          ],
        }),
      }),
    )

    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/championship')
    await expect(page.getByTestId('championship-data-notice')).toContainText(/Stale/i)
    await expect(page.getByTestId('champ-view-drivers')).toBeVisible()
    await page.screenshot({
      path: path.join(evidenceDir, `championship-stale-tablet-${testInfo.project.name}.png`),
      fullPage: true,
    })
  })

  test('Briefing Limited notice keeps articles usable', async ({ page }, testInfo) => {
    await page.route('**/api/v1/news**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        headers: {
          'X-BoxBox-Data-Source': 'local',
          'X-BoxBox-Data-Freshness': 'local',
        },
        body: JSON.stringify([
          {
            id: 1,
            title: 'Paddock briefing sample',
            url: 'https://example.com/a',
            source: 'Autosport',
            published_at: '2025-04-01T12:00:00Z',
            summary: 'Sample article remains usable.',
            category: 'news',
          },
        ]),
      }),
    )
    await page.route('**/api/v1/seasons', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([2025]) }),
    )
    await page.route('**/api/v1/meetings**', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'API 503: meetings unavailable' }),
      }),
    )
    await page.route('**/api/v1/championship/hub**', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'API 503: hub unavailable' }),
      }),
    )

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/briefing')
    await expect(page.getByTestId('briefing-data-notice')).toContainText(/Limited/i)
    await expect(page.getByText('Paddock briefing sample')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/API 503/i)
    await page.screenshot({
      path: path.join(evidenceDir, `briefing-limited-mobile-${testInfo.project.name}.png`),
      fullPage: true,
    })
  })
})
