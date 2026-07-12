import { expect, type Locator, type Page } from '@playwright/test'
import { FUTURE_SESSION, mockFutureRaceHubSession } from '../fixtures/future-session'

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const

export const FULL_SESSION = 9472
export { FUTURE_SESSION }

/** Wait for web fonts and layout to settle before screenshots. */
export async function waitForScreenshotReady(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(150)
}

export async function gotoWeekendReady(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('weekend-page')).toBeVisible()
  // The seeded hermetic DB (Monaco 2025, completed) resolves to season_complete,
  // rendered by the between-races surface.
  await expect(page.getByTestId('weekend-between-races')).toBeVisible()
  await expect(page.getByTestId('wk-last-event')).toBeVisible()
  await waitForScreenshotReady(page)
}

export async function gotoRaceHubReady(page: Page, sessionKey = FULL_SESSION): Promise<void> {
  await page.goto(`/race-hub?session_key=${sessionKey}`)
  await expect(page.getByTestId('race-hub')).toBeVisible()
  await expect(page.getByTestId('rh-identity')).toBeVisible()
  await expect(page.getByTestId(`rh-session-${sessionKey}`)).toBeVisible()
  await expect(page.getByTestId('rh-overview')).toBeVisible()
  await waitForScreenshotReady(page)
}

export async function gotoRaceHubFutureReady(
  page: Page,
  sessionKey = FUTURE_SESSION,
): Promise<void> {
  await mockFutureRaceHubSession(page)
  await page.goto(`/race-hub?session_key=${sessionKey}`)
  await expect(page.getByTestId('race-hub')).toBeVisible()
  await expect(page.getByTestId('rh-presession')).toBeVisible()
  await waitForScreenshotReady(page)
}

export async function gotoRaceStoryReady(page: Page, sessionKey = FULL_SESSION): Promise<void> {
  await page.goto(`/race-hub?session_key=${sessionKey}`)
  await expect(page.getByTestId('race-hub')).toBeVisible()
  await page.getByRole('tab', { name: 'Race Story' }).click()
  await expect(page.getByTestId('position-chart')).toBeVisible()
  await waitForScreenshotReady(page)
}

export async function gotoDataLibraryReady(page: Page): Promise<void> {
  await page.goto('/admin')
  await expect(page.getByTestId('data-library')).toBeVisible()
  await expect(page.getByTestId('dl-meeting-1229')).toBeVisible()
  await expect(page.getByTestId('meeting-detail')).toBeVisible()
  await waitForScreenshotReady(page)
}

export async function gotoLiveInactiveReady(page: Page): Promise<void> {
  await page.goto('/live')
  await expect(page.locator('.loading-state')).toHaveCount(0)
  // With BOXBOX_DISABLE_LIVE=1 the feed is silent, so the page settles into the
  // inactive weekend-context handoff sourced from /api/v1/weekend-context.
  await expect(page.getByTestId('live-inactive')).toBeVisible()
  // Integrated #73 shell — stale Command/Live/Race Hub baselines must not pass.
  await expect(page.getByRole('navigation')).toContainText('Weekend')
  await expect(page.getByRole('navigation')).not.toContainText('Command')
  await waitForScreenshotReady(page)
}

/** Deterministic active Live hierarchy (mocked snapshot + sticky SSE). */
export async function gotoLiveActiveReady(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear()
    class StickyEventSource {
      onopen: ((ev: Event) => void) | null = null
      onerror: ((ev: Event) => void) | null = null
      constructor(_url: string | URL) {
        queueMicrotask(() => this.onopen?.(new Event('open')))
      }
      addEventListener(_type: string, _listener: EventListenerOrEventListenerObject) {}
      close() {}
    }
    Object.defineProperty(window, 'EventSource', {
      configurable: true,
      writable: true,
      value: StickyEventSource,
    })
  })

  const driver = (
    num: string,
    pos: number,
    interval: string,
    gap: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    RacingNumber: num,
    Position: pos,
    PrevPosition: pos,
    GapToLeader: gap,
    Interval: interval,
    LastLapTime: '1:21.345',
    LastLapPB: false,
    LastLapOB: false,
    BestLapTime: '1:20.987',
    BestLapPB: true,
    BestLapOB: false,
    BestLapNum: 22,
    InPit: false,
    PitOut: false,
    Retired: false,
    KnockedOut: false,
    Cutoff: false,
    OnFlyingLap: false,
    NumberOfLaps: 30,
    SpeedTrap: '312',
    Sectors: [],
    ...overrides,
  })
  const info = (num: string, tla: string, first: string, last: string, team: string, colour: string) => ({
    RacingNumber: num,
    BroadcastName: `${first[0]} ${last.toUpperCase()}`,
    Tla: tla,
    TeamName: team,
    TeamColour: colour,
    FirstName: first,
    LastName: last,
  })

  const liveState = {
    is_live: true,
    data: {
      Drivers: {
        '1': driver('1', 1, '', ''),
        '4': driver('4', 2, '+0.523', '+0.523'),
        '44': driver('44', 3, '+3.214', '+3.737'),
        '63': driver('63', 4, '+12.001', '+15.738', { InPit: true }),
      },
      DriverInfo: {
        '1': info('1', 'VER', 'Max', 'Verstappen', 'Red Bull Racing', '3671C6'),
        '4': info('4', 'NOR', 'Lando', 'Norris', 'McLaren', 'FF8000'),
        '44': info('44', 'HAM', 'Lewis', 'Hamilton', 'Ferrari', 'E80020'),
        '63': info('63', 'RUS', 'George', 'Russell', 'Mercedes', '27F4D2'),
      },
      Tyres: {
        '1': { Compound: 'HARD', New: false, Age: 12 },
        '4': { Compound: 'MEDIUM', New: false, Age: 8 },
        '44': { Compound: 'MEDIUM', New: true, Age: 3 },
        '63': { Compound: 'HARD', New: true, Age: 0 },
      },
      Stints: {
        '1': [
          { Compound: 'MEDIUM', New: true, Laps: 18 },
          { Compound: 'HARD', New: false, Laps: 12 },
        ],
        '4': [
          { Compound: 'SOFT', New: true, Laps: 14 },
          { Compound: 'MEDIUM', New: true, Laps: 16 },
        ],
      },
      RCMessages: [
        {
          Time: '2026-07-03T14:05:00Z',
          Category: 'Flag',
          Flag: 'YELLOW',
          Message: 'YELLOW IN SECTOR 2',
          Lap: 29,
        },
      ],
      Weather: {
        AirTemp: 22.5,
        TrackTemp: 41.3,
        Humidity: 58,
        WindSpeed: 3.4,
        WindDir: 180,
        Rainfall: false,
      },
      Session: {
        MeetingName: 'Testonia Grand Prix',
        CircuitName: 'Testring',
        SessionType: 'Race',
        SessionName: 'Race',
        Path: '',
      },
      TeamRadio: [],
      SessionStatus: 'Started',
      TrackStatus: '2',
      CurrentLap: 30,
      TotalLaps: 57,
      // Fixed empty clock → "--:--:--" (no live extrapolation drift).
      Clock: '',
      ClockRefTime: '',
      ClockExtrapolating: false,
      Telemetry: {},
    },
  }

  await page.route('**/api/v1/live/state', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(liveState) }),
  )
  await page.route('**/api/v1/live/stream', (route) =>
    route.fulfill({
      contentType: 'text/event-stream',
      body: 'event: heartbeat\ndata: {}\n\n',
    }),
  )

  await page.goto('/live')
  await expect(page.getByTestId('live-page')).toHaveAttribute('data-phase', 'live')
  await expect(page.getByTestId('live-session-flag')).toContainText('LIVE SESSION')
  await expect(page.getByText('Timing Tower')).toBeVisible()
  await expect(page.getByRole('navigation')).toContainText('Weekend')
  await expect(page.getByRole('navigation')).not.toContainText('Command')
  await waitForScreenshotReady(page)
}

export async function screenshotPage(
  page: Page,
  name: string,
  options?: { mask?: Locator[] },
): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    mask: options?.mask,
  })
}
