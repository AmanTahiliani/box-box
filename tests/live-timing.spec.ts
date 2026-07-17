import { test, expect } from '@playwright/test'

// The e2e server runs with BOXBOX_DISABLE_LIVE=1, so the real feed is silent.
// These tests mock /api/v1/live/state with a race snapshot to exercise the
// full timing page: flag banner, weather strip, battles, stints, and pinning.

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

const raceSnapshot = {
  is_live: true,
  data: {
    Drivers: {
      '1': driver('1', 1, '', '', { NumberOfLaps: 30 }),
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
      { Time: '2026-07-03T14:05:00Z', Category: 'Flag', Flag: 'YELLOW', Message: 'YELLOW IN SECTOR 2', Lap: 29 },
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
    },
    TrackStatus: '2',
    CurrentLap: 30,
    TotalLaps: 57,
    Clock: '',
    ClockRefTime: '',
    ClockExtrapolating: false,
  },
}

const sprintQualifyingSnapshot = {
  is_live: true,
  data: {
    ...raceSnapshot.data,
    Drivers: Object.fromEntries(
      Array.from({ length: 22 }, (_, index) => {
        const num = String(index + 1)
        return [
          num,
          driver(num, index + 1, index === 0 ? '' : `+${(index * 0.123).toFixed(3)}`, index === 0 ? '' : `+${(index * 0.123).toFixed(3)}`, {
            LastLapTime: index < 2 ? '1:29.273' : '',
            BestLapTime: `1:${String(29 + Math.floor(index / 10)).padStart(2, '0')}.${String(273 + index).padStart(3, '0')}`,
            NumberOfLaps: 4,
            Sectors: index === 7
              ? [{ Value: '28.573', PersonalFastest: false, OverallFastest: false }, { Value: '', PersonalFastest: false, OverallFastest: false }, { Value: '', PersonalFastest: false, OverallFastest: false }]
              : [],
            OnFlyingLap: index === 7,
          }),
        ]
      }),
    ),
    DriverInfo: Object.fromEntries(
      Array.from({ length: 22 }, (_, index) => {
        const num = String(index + 1)
        return [num, info(num, `D${index + 1}`, 'Driver', String(index + 1), 'Test Team', index % 2 ? 'FF8000' : '27F4D2')]
      }),
    ),
    Tyres: Object.fromEntries(
      Array.from({ length: 22 }, (_, index) => [String(index + 1), { Compound: 'MEDIUM', New: false, Age: index % 4 }]),
    ),
    Session: {
      MeetingName: 'British Grand Prix',
      CircuitName: 'Silverstone',
      SessionType: 'Sprint Qualifying',
      SessionName: 'Sprint Qualifying',
    },
    TrackStatus: '1',
    CurrentLap: 0,
    TotalLaps: 0,
    Clock: '00:02:11',
    ClockRefTime: '2026-07-03T15:39:49Z',
    ClockExtrapolating: false,
  },
}

// Practice: the feed sets best laps but no GapToLeader/Interval, and there is
// no race lap-total concept. Exercises computed gaps, the non-race banner, the
// collapsed-by-default tyre panel, and the 390px core-field layout.
const practiceSnapshot = {
  is_live: true,
  data: {
    ...raceSnapshot.data,
    Drivers: Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => {
        const num = String(index + 1)
        return [
          num,
          driver(num, index + 1, '', '', {
            // Distinct, increasing best laps; P1 fastest, +0.200s per position.
            BestLapTime: `1:${(45.9 + index * 0.2).toFixed(3).padStart(6, '0')}`,
            LastLapTime: '1:46.500',
            NumberOfLaps: 12,
            Sectors: index === 0
              ? [
                  { Value: '28.500', PersonalFastest: true, OverallFastest: false },
                  { Value: '52.100', PersonalFastest: false, OverallFastest: false },
                  { Value: '25.344', PersonalFastest: false, OverallFastest: false },
                ]
              : [],
          }),
        ]
      }),
    ),
    DriverInfo: Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => {
        const num = String(index + 1)
        return [num, info(num, `D${index + 1}`, 'Driver', String(index + 1), 'Test Team', index % 2 ? 'FF8000' : '27F4D2')]
      }),
    ),
    Tyres: Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [String(index + 1), { Compound: 'SOFT', New: false, Age: index % 4 }]),
    ),
    Session: {
      MeetingName: 'Belgian Grand Prix',
      CircuitName: 'Spa-Francorchamps',
      SessionType: 'Practice',
      SessionName: 'Practice 2',
    },
    TrackStatus: '1',
    CurrentLap: 0,
    TotalLaps: 0,
    Clock: '00:45:00',
    ClockRefTime: '2026-07-17T13:00:00Z',
    ClockExtrapolating: false,
  },
}

test.describe('Live Timing (mocked snapshot)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/live/state', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(raceSnapshot) }),
    )
    // A single heartbeat then EOF; the page keeps the query snapshot either way.
    await page.route('**/api/v1/live/stream', (route) =>
      route.fulfill({
        contentType: 'text/event-stream',
        body: 'event: heartbeat\ndata: {}\n\n',
      }),
    )
    await page.goto('/live')
  })

  test('renders timing tower with drivers from the snapshot', async ({ page }) => {
    await expect(page.getByTestId('live-page')).toBeVisible()
    const tower = page.locator('.live-tower')
    await expect(tower).toBeVisible()
    await expect(tower).toContainText('VER')
    await expect(tower).toContainText('NOR')
    await expect(tower).toContainText('HAM')
    await expect(tower.locator('tr.in-pit')).toContainText('RUS')
  })

  test('shows yellow flag banner from TrackStatus', async ({ page }) => {
    const banner = page.getByTestId('track-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('YELLOW FLAG')
  })

  test('shows weather strip with track temperature', async ({ page }) => {
    const weather = page.getByTestId('weather-strip')
    await expect(weather).toBeVisible()
    await expect(weather).toContainText('41°C')
  })

  test('detects the VER/NOR battle and highlights it', async ({ page }) => {
    const chips = page.getByTestId('battle-chips')
    await expect(chips).toBeVisible()
    await expect(chips).toContainText('VER ⚔ NOR')
    // The in-pit car must never be part of a battle group.
    await expect(chips).not.toContainText('RUS')
  })

  test('renders stint history for drivers that have stints', async ({ page }) => {
    await page.locator('.live-tower tbody tr', { hasText: 'VER' }).click()
    await expect(page.getByTestId('stint-seq').first()).toBeVisible()
  })

  test('clicking a pin button pins the driver to the focus strip', async ({ page }) => {
    await page.locator('.live-tower tbody tr', { hasText: 'VER' }).locator('.pin-btn').click()
    const pinned = page.getByTestId('pinned-strip')
    await expect(pinned).toBeVisible()
    await expect(pinned).toContainText('VER')

    // Unpin restores the empty strip.
    await page.locator('.live-tower tbody tr', { hasText: 'VER' }).locator('.pin-btn').click()
    await expect(page.getByTestId('pinned-strip')).toHaveCount(0)
  })
})

test.describe('Live Timing (mocked Sprint Qualifying)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/live/state', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(sprintQualifyingSnapshot) }),
    )
    await page.route('**/api/v1/live/stream', (route) =>
      route.fulfill({
        contentType: 'text/event-stream',
        body: 'event: heartbeat\ndata: {}\n\n',
      }),
    )
    await page.goto('/live')
  })

  test('shows SQ1 phase, large clock, and 22-car cutoff after P17', async ({ page }) => {
    await expect(page.getByText('SQ1', { exact: true })).toBeVisible()
    await expect(page.getByTestId('live-clock')).toContainText('00:02:11')
    await expect(page.getByTestId('qualifying-cutoff')).toContainText('P17 advance')
    await expect(page.getByTestId('qualifying-cutoff')).toContainText('P18-P22 at risk')
    await expect(page.locator('.live-tower tbody tr', { hasText: 'D18' })).toHaveClass(/danger-row/)
    await expect(page.locator('.live-tower tbody tr', { hasText: 'D8' })).toHaveClass(/flying-row/)
  })
})

test.describe('Live Timing (mocked Practice)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/live/state', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(practiceSnapshot) }),
    )
    await page.route('**/api/v1/live/stream', (route) =>
      route.fulfill({ contentType: 'text/event-stream', body: 'event: heartbeat\ndata: {}\n\n' }),
    )
    await page.goto('/live')
  })

  test('derives a gap to P1 from best laps and marks the leader', async ({ page }) => {
    const tower = page.locator('.live-tower')
    await expect(tower).toBeVisible()
    // P1 shows a leader marker, not a fabricated gap.
    await expect(tower.locator('tbody tr').first()).toContainText('—')
    // P2 shows the computed +0.200 delta.
    await expect(tower).toContainText('+0.200')
  })

  test('omits the race lap counter and keeps the session clock for practice', async ({ page }) => {
    await expect(page.getByTestId('live-lap-counter')).toHaveCount(0)
    await expect(page.getByTestId('live-clock')).toContainText('00:45:00')
    await expect(page.locator('.live-banner')).not.toContainText('L-/-')
  })

  test('collapses the tyre panel by default so the tower is above the fold', async ({ page }) => {
    await expect(page.getByTestId('tyredeg-panel')).toBeVisible()
    await expect(page.getByTestId('tyredeg-row')).toHaveCount(0)
    await expect(page.locator('.live-tower')).toBeVisible()
  })

  test('labels Race Control times as UTC', async ({ page }) => {
    await expect(page.getByTestId('rc-timezone')).toContainText('UTC')
  })

  test('marks Live as active in the primary navigation', async ({ page }) => {
    await expect(page.getByTestId('nav-live')).toHaveAttribute('data-live-active', 'true')
    await expect(page.getByTestId('nav-live').locator('.nav-live-dot')).toBeVisible()
  })
})

test.describe('Live Timing (390px practice viewport)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/live/state', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(practiceSnapshot) }),
    )
    await page.route('**/api/v1/live/stream', (route) =>
      route.fulfill({ contentType: 'text/event-stream', body: 'event: heartbeat\ndata: {}\n\n' }),
    )
    await page.goto('/live')
  })

  test('shows the five core fields with no horizontal overflow', async ({ page }) => {
    const tower = page.locator('.live-tower')
    await expect(tower).toBeVisible()

    // Core comparison fields are present in the header.
    await expect(tower.locator('thead')).toContainText('Pos')
    await expect(tower.locator('thead')).toContainText('Driver')
    await expect(tower.locator('thead')).toContainText('Tyre')
    await expect(tower.locator('thead')).toContainText('Best')
    await expect(tower.locator('thead')).toContainText('Gap to P1')

    // Sectors are hidden from the initial mobile tower (reachable via expand).
    const firstSector = tower.locator('thead th', { hasText: 'S1' })
    await expect(firstSector).toBeHidden()

    // The document must not scroll horizontally.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('exposes sectors through the row detail interaction', async ({ page }) => {
    // Sector columns are not in the initial mobile tower...
    await expect(page.locator('.live-tower thead th', { hasText: 'S1' })).toBeHidden()
    // ...but the P1 row's sectors are reachable by expanding the row.
    await page.locator('.live-tower tbody tr', { hasText: 'D1' }).first().click()
    const sectors = page.getByTestId('expanded-sectors')
    await expect(sectors).toBeVisible()
    await expect(sectors).toContainText('28.500')
  })
})

test.describe('Live Timing (no session)', () => {
  test('shows the empty state when the feed has no snapshot', async ({ page }) => {
    await page.goto('/live')
    await expect(page.getByTestId('live-empty')).toBeVisible()
    await expect(page.getByTestId('live-page')).toContainText('No live session active')
  })

  test('renders an archived snapshot only after View Last Session', async ({ page }) => {
    await page.route('**/api/v1/live/state', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          is_live: false,
          data: null,
          last_snapshot: {
            ...raceSnapshot.data,
            SessionStatus: 'Finished',
          },
          last_positions: {
            '1': { x: 100, y: -50, z: 2, status: 'OnTrack' },
          },
          last_snapshot_at: '2026-07-04T14:00:00Z',
        }),
      }),
    )
    await page.route('**/api/v1/live/stream', (route) =>
      route.fulfill({
        contentType: 'text/event-stream',
        body: 'event: heartbeat\ndata: {}\n\n',
      }),
    )

    await page.goto('/live')
    await expect(page.getByTestId('live-empty')).toContainText('No live session active')
    await expect(page.getByText('Timing Tower')).toHaveCount(0)

    await page.getByRole('button', { name: 'View Last Session' }).click()
    await expect(page.getByTestId('live-archive-strip')).toContainText('Archived snapshot')
    await expect(page.getByText('Timing Tower')).toBeVisible()
    await expect(page.locator('.live-state')).toContainText('archive')
  })
})
