import type { Page } from '@playwright/test'

/** Isolated future-session key — not present in the shared e2e seed DB. */
export const FUTURE_SESSION = 9600
export const FUTURE_MEETING = 1300

const emptyDatasets = {}

const futureMeeting = {
  meeting_key: FUTURE_MEETING,
  meeting_name: 'Future Grand Prix',
  meeting_official_name: 'FORMULA 1 FUTURE GRAND PRIX 2099',
  location: 'Futureville',
  country_name: 'Testland',
  country_code: 'TST',
  country_flag: '',
  circuit_short_name: 'Future',
  date_start: '2099-05-23T00:00:00+00:00',
  date_end: '2099-05-25T00:00:00+00:00',
  year: 2099,
}

const futureSession = {
  session_key: FUTURE_SESSION,
  session_name: 'Race',
  session_type: 'Race',
  meeting_key: FUTURE_MEETING,
  date_start: '2099-05-25T13:00:00+00:00',
  date_end: '2099-05-25T15:00:00+00:00',
  gmt_offset: '00:00:00',
}

const futureRaceHub = {
  source: 'none',
  session_key: FUTURE_SESSION,
  datasets: emptyDatasets,
  meeting: futureMeeting,
  session: futureSession,
  drivers: [],
  results: [],
  starting_grid: [],
  stints: [],
  pit_stops: [],
  positions: [],
  race_control: [],
  weather: [],
  laps: [],
  chapters: [],
}

const futureWeekend = {
  source: 'none',
  meeting_key: FUTURE_MEETING,
  meeting: futureMeeting,
  default_session_key: FUTURE_SESSION,
  sessions: [{ session: futureSession, source: 'none', datasets: emptyDatasets }],
}

/**
 * Route-mock a far-future session without contaminating the shared Monaco seed
 * (which would rewrite Command Center / Data Library baselines).
 */
export async function mockFutureRaceHubSession(page: Page): Promise<void> {
  await page.route(`**/api/v1/race-hub?session_key=${FUTURE_SESSION}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(futureRaceHub),
    })
  })
  await page.route(`**/api/v1/weekend?meeting_key=${FUTURE_MEETING}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(futureWeekend),
    })
  })
}
