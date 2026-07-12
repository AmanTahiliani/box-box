import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Outlet,
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
} from '@tanstack/react-router'
import { WeekendPage } from '../pages/WeekendPage'
import type {
  ChampionshipHub,
  ContextAvailability,
  ContextSession,
  Meeting,
  RaceHub,
  Session,
  TemporalState,
  WeekendContext,
} from '../types'

vi.mock('../api', () => ({
  fetchWeekendContext: vi.fn(),
  fetchChampionshipHub: vi.fn(),
  fetchNews: vi.fn(),
  fetchRaceHub: vi.fn(),
  // Consumed transitively by RacePreviewPage (folded into PreSessionView):
  fetchSeasons: vi.fn(),
  fetchMeetings: vi.fn(),
  fetchSessions: vi.fn(),
  fetchResults: vi.fn(),
  fetchStartingGrid: vi.fn(),
  fetchTrackOutline: vi.fn(),
}))

import {
  fetchWeekendContext,
  fetchChampionshipHub,
  fetchNews,
  fetchRaceHub,
  fetchSeasons,
  fetchMeetings,
  fetchSessions,
  fetchResults,
  fetchStartingGrid,
  fetchTrackOutline,
} from '../api'

const mockContext = vi.mocked(fetchWeekendContext)
const mockHub = vi.mocked(fetchChampionshipHub)
const mockNews = vi.mocked(fetchNews)
const mockRaceHub = vi.mocked(fetchRaceHub)
const mockSeasons = vi.mocked(fetchSeasons)
const mockMeetings = vi.mocked(fetchMeetings)
const mockSessions = vi.mocked(fetchSessions)
const mockResults = vi.mocked(fetchResults)
const mockGrid = vi.mocked(fetchStartingGrid)
const mockTrack = vi.mocked(fetchTrackOutline)

function availability(overrides: Partial<ContextAvailability> = {}): ContextAvailability {
  return {
    schedule: 'available',
    live_transport: 'unknown',
    live_session: 'inactive',
    archive: 'unavailable',
    local_analysis: 'complete',
    freshness: 'fresh',
    limitations: [],
    ...overrides,
  }
}

function meeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    meeting_key: 1,
    meeting_name: 'British Grand Prix',
    meeting_official_name: 'FORMULA 1 BRITISH GRAND PRIX',
    location: 'Silverstone',
    country_name: 'United Kingdom',
    country_code: 'GBR',
    country_flag: '',
    circuit_key: 2,
    circuit_short_name: 'Silverstone',
    date_start: '2026-07-03T09:00:00Z',
    date_end: '2026-07-05T16:00:00Z',
    year: 2026,
    ...overrides,
  }
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    session_key: 11,
    session_name: 'Race',
    session_type: 'Race',
    meeting_key: 1,
    date_start: '2026-07-05T14:00:00Z',
    date_end: '2026-07-05T16:00:00Z',
    gmt_offset: '',
    ...overrides,
  }
}

function ctxSession(overrides: Partial<ContextSession> = {}): ContextSession {
  return {
    session: session(),
    meeting: meeting(),
    availability: availability(),
    ...overrides,
  }
}

function context(overrides: Partial<WeekendContext> = {}): WeekendContext {
  return {
    season: 2026,
    temporal_state: 'between_weekends',
    championship_round: 5,
    total_championship_rounds: 24,
    ...overrides,
  }
}

const hub: ChampionshipHub = {
  season: 2026,
  round: 5,
  total_rounds: 24,
  rounds_left: 19,
  last_race: 'British GP',
  round_labels: [],
  drivers: [
    { driver_number: 1, name_acronym: 'VER', full_name: 'Max', team_name: 'RB', team_colour: '3671c6', points: 120, position: 1, wins: 4, podiums: 5, poles: 3, form: [], cumulative: [95, 120], teammate_wins: 0, teammate_losses: 0, round_positions: [] },
  ],
  teams: [],
}

const raceHub = {
  session_key: 11,
  results: [
    { driver_number: 1, position: 1, name_acronym: 'VER', full_name: 'Max', team_name: 'RB', team_colour: '3671c6', dnf: false, dns: false, dsq: false, duration: 5400, gap_to_leader: null },
  ],
} as unknown as RaceHub

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    ),
  })
  const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <WeekendPage /> })
  const previewRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/preview',
    component: () => <WeekendPage preview />,
  })
  const raceHubRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/race-hub',
    validateSearch: (s: Record<string, unknown>) => {
      const sk = Number(s.session_key)
      return Number.isFinite(sk) && sk > 0 ? { session_key: sk } : {}
    },
    component: () => <div data-testid="race-hub-stub" />,
  })
  const stub = (p: string, id: string) =>
    createRoute({ getParentRoute: () => rootRoute, path: p, component: () => <div data-testid={id} /> })

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      homeRoute,
      previewRoute,
      raceHubRoute,
      stub('/live', 'live-stub'),
      stub('/explore', 'explore-stub'),
      stub('/championship', 'championship-stub'),
      stub('/briefing', 'briefing-stub'),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  return render(<RouterProvider router={router} />)
}

describe('WeekendPage canonical contract rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(new Date('2026-07-08T12:00:00Z'))
    mockHub.mockResolvedValue(hub)
    mockNews.mockResolvedValue([])
    mockRaceHub.mockResolvedValue(raceHub)
    mockSeasons.mockResolvedValue([2026])
    mockMeetings.mockResolvedValue([meeting()])
    mockSessions.mockResolvedValue([session()])
    mockResults.mockResolvedValue([])
    mockGrid.mockResolvedValue([])
    mockTrack.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the loading surface before the canonical context resolves', async () => {
    mockContext.mockReturnValue(new Promise(() => {}))
    renderAt('/')
    await waitFor(() => expect(screen.getByTestId('weekend-loading')).toBeInTheDocument())
  })

  it('shows an explicit error surface when the canonical endpoint fails', async () => {
    mockContext.mockRejectedValue(new Error('API 500: boom'))
    renderAt('/')
    await waitFor(() => expect(screen.getByTestId('weekend-error')).toBeInTheDocument())
    expect(screen.getByTestId('weekend-error')).toHaveTextContent('boom')
  })

  const stateCases: Array<[TemporalState, string]> = [
    ['between_weekends', 'weekend-between-races'],
    ['post_weekend', 'weekend-between-races'],
    ['season_complete', 'weekend-between-races'],
    ['pre_session', 'weekend-pre-session'],
    ['between_sessions', 'weekend-between-sessions'],
    ['session_settling', 'weekend-between-sessions'],
    ['session_live', 'weekend-live'],
  ]

  it.each(stateCases)('renders a designed surface for canonical temporal_state %s', async (temporal, testid) => {
    mockContext.mockResolvedValue(
      context({
        temporal_state: temporal,
        previous_completed_session: ctxSession({ session: session({ session_key: 11, session_name: 'Race' }) }),
        default_analysis_session: ctxSession({ session: session({ session_key: 11 }) }),
        next_meeting: meeting({ meeting_key: 2, meeting_name: 'Hungarian Grand Prix', date_start: '2026-07-24T09:00:00Z' }),
        next_session: ctxSession({ session: session({ session_key: 21, session_name: 'Practice 1', date_start: '2026-07-24T09:00:00Z' }) }),
        active_session: temporal === 'session_live'
          ? ctxSession({ session: session({ session_key: 12, session_name: 'Race' }), availability: availability({ live_session: 'active' }) })
          : undefined,
        focus_meeting: meeting(),
      }),
    )
    renderAt('/')
    await waitFor(() => expect(screen.getByTestId('weekend-page')).toHaveAttribute('data-temporal-state', temporal))
    expect(screen.getByTestId(testid)).toBeInTheDocument()
  })

  it('renders the limited surface for no_season and never falls through to it for a valid payload', async () => {
    mockContext.mockResolvedValue(context({ temporal_state: 'no_season', championship_round: 0, total_championship_rounds: 0 }))
    renderAt('/')
    await waitFor(() => expect(screen.getByTestId('weekend-limited')).toBeInTheDocument())
  })

  it('between-races pairs the completed analysis CTA with the next-event countdown and championship impact', async () => {
    mockContext.mockResolvedValue(
      context({
        previous_completed_session: ctxSession({ session: session({ session_key: 11, session_name: 'Race' }) }),
        default_analysis_session: ctxSession({ session: session({ session_key: 11 }) }),
        next_meeting: meeting({ meeting_key: 2, meeting_name: 'Hungarian Grand Prix', date_start: '2026-07-24T09:00:00Z' }),
        next_session: ctxSession({ session: session({ session_key: 21, session_name: 'Practice 1', date_start: '2026-07-24T09:00:00Z' }) }),
      }),
    )
    renderAt('/')
    await waitFor(() => expect(screen.getByTestId('wk-last-event')).toBeInTheDocument())
    expect(screen.getByTestId('wk-next-event')).toBeInTheDocument()
    const story = screen.getByTestId('wk-explore-race-story')
    expect(story).toHaveAttribute('href', expect.stringContaining('session_key=11'))
    expect(screen.getByTestId('wk-prepare')).toHaveAttribute('href', '/preview')
    await waitFor(() => expect(screen.getByTestId('wk-champ-impact')).toBeInTheDocument())
    expect(screen.getByTestId('wk-season-nav')).toHaveTextContent('Round 5 of 24')
  })

  it('does not fan out to season/meeting/OpenF1/live queries when the canonical context succeeds', async () => {
    mockContext.mockResolvedValue(context({ temporal_state: 'between_weekends' }))
    renderAt('/')
    await waitFor(() => expect(screen.getByTestId('weekend-between-races')).toBeInTheDocument())
    // Only supplementary championship + news reads are allowed; no season /
    // meetings / sessions / live fan-out from the Weekend home hook.
    expect(mockSeasons).not.toHaveBeenCalled()
    expect(mockSessions).not.toHaveBeenCalled()
    // fetchMeetings may still be reached only through the folded preview surface,
    // which is not mounted in the between-races state.
    expect(mockMeetings).not.toHaveBeenCalled()
  })

  it('supplementary reads stay dormant while the canonical context is pending', async () => {
    mockContext.mockReturnValue(new Promise(() => {}))
    renderAt('/')
    await waitFor(() => expect(screen.getByTestId('weekend-loading')).toBeInTheDocument())
    expect(mockHub).not.toHaveBeenCalled()
    expect(mockNews).not.toHaveBeenCalled()
  })

  it('the /preview alias renders the preparation surface instead of looping back', async () => {
    mockContext.mockResolvedValue(
      context({
        temporal_state: 'between_weekends',
        next_meeting: meeting({ meeting_key: 2, meeting_name: 'Hungarian Grand Prix', date_start: '2026-07-24T09:00:00Z' }),
        next_session: ctxSession({ session: session({ session_key: 21, session_name: 'Practice 1', date_start: '2026-07-24T09:00:00Z' }) }),
      }),
    )
    renderAt('/preview')
    await waitFor(() => expect(screen.getByTestId('weekend-pre-session')).toBeInTheDocument())
    expect(screen.getByTestId('weekend-page')).toHaveAttribute('data-preview', 'true')
    // The between-races surface must NOT be what /preview renders.
    expect(screen.queryByTestId('weekend-between-races')).not.toBeInTheDocument()
  })
})
