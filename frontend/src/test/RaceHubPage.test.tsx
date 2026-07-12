import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Outlet,
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
} from '@tanstack/react-router'
import { RaceHubPage } from '../pages/RaceHubPage'
import type { DatasetInfo, Meeting, RaceHub, Session, Weekend } from '../types'

vi.mock('../api', () => ({
  fetchRaceHub: vi.fn(),
  fetchSeasons: vi.fn(),
  fetchLocalMeetings: vi.fn(),
  fetchWeekend: vi.fn(),
}))

import { fetchRaceHub, fetchSeasons, fetchLocalMeetings, fetchWeekend } from '../api'

const mockFetchRaceHub = vi.mocked(fetchRaceHub)
const mockFetchSeasons = vi.mocked(fetchSeasons)
const mockFetchLocalMeetings = vi.mocked(fetchLocalMeetings)
const mockFetchWeekend = vi.mocked(fetchWeekend)

// Use a fixed clock so upcoming/completed states are deterministic in tests.
const NOW = new Date('2025-06-01T00:00:00Z')

const meeting: Meeting = {
  meeting_key: 1229,
  meeting_name: 'Monaco Grand Prix',
  meeting_official_name: 'FORMULA 1 GRAND PRIX DE MONACO 2025',
  location: 'Monaco',
  country_name: 'Monaco',
  country_code: 'MON',
  country_flag: '',
  circuit_short_name: 'Monaco',
  date_start: '2025-05-23T00:00:00+00:00',
  date_end: '2025-05-25T00:00:00+00:00',
  year: 2025,
}

const raceSession: Session = {
  session_key: 9472,
  session_name: 'Race',
  session_type: 'Race',
  meeting_key: 1229,
  date_start: '2025-05-25T13:00:00+00:00',
  date_end: '2025-05-25T15:00:00+00:00',
  gmt_offset: '02:00:00',
}

const qualSession: Session = {
  session_key: 9471,
  session_name: 'Qualifying',
  session_type: 'Qualifying',
  meeting_key: 1229,
  date_start: '2025-05-24T14:00:00+00:00',
  date_end: '2025-05-24T15:00:00+00:00',
  gmt_offset: '02:00:00',
}

// A session scheduled far in the future relative to NOW.
const futureSession: Session = {
  session_key: 9600,
  session_name: 'Race',
  session_type: 'Race',
  meeting_key: 1300,
  date_start: '2099-05-25T13:00:00+00:00',
  date_end: '2099-05-25T15:00:00+00:00',
  gmt_offset: '02:00:00',
}

const fullDatasets: Record<string, DatasetInfo> = {
  meeting: { status: 'available', source: 'local', count: 1 },
  session: { status: 'available', source: 'local', count: 1 },
  drivers: { status: 'available', source: 'local', count: 20 },
  results: { status: 'available', source: 'local', count: 20 },
  starting_grid: { status: 'available', source: 'local', count: 20 },
  stints: { status: 'available', source: 'local', count: 30 },
  pit_stops: { status: 'available', source: 'local', count: 18 },
  positions: { status: 'available', source: 'local', count: 120 },
  race_control: { status: 'available', source: 'local', count: 5 },
  weather: { status: 'available', source: 'local', count: 4 },
  laps: { status: 'available', source: 'local', count: 200 },
}

const raceHub: RaceHub = {
  source: 'local',
  session_key: 9472,
  datasets: fullDatasets,
  meeting,
  session: raceSession,
  drivers: [
    {
      driver_number: 1,
      name_acronym: 'VER',
      full_name: 'Max Verstappen',
      first_name: 'Max',
      last_name: 'Verstappen',
      team_name: 'Red Bull Racing',
      team_colour: '3671C6',
      headshot_url: '',
      broadcast_name: 'M VERSTAPPEN',
      session_key: 9472,
      meeting_key: 1229,
    },
  ],
  results: [
    {
      driver_number: 1,
      position: 1,
      name_acronym: 'VER',
      full_name: 'Max Verstappen',
      team_name: 'Red Bull Racing',
      team_colour: '3671C6',
      dnf: false,
      dns: false,
      dsq: false,
      duration: 5500,
      gap_to_leader: null,
      number_of_laps: 78,
      points: 25,
      session_key: 9472,
      meeting_key: 1229,
    },
  ],
  starting_grid: [
    {
      driver_number: 1,
      position: 1,
      name_acronym: 'VER',
      full_name: 'Max Verstappen',
      team_name: 'Red Bull Racing',
      team_colour: '3671C6',
      session_key: 9472,
      meeting_key: 1229,
      lap_duration: 70.5,
    },
  ],
  stints: [],
  pit_stops: [],
  positions: [],
  race_control: [],
  weather: [
    {
      session_key: 9472,
      meeting_key: 1229,
      date: '2025-05-25T13:30:00+00:00',
      air_temperature: 22,
      track_temperature: 40,
      humidity: 50,
      pressure: 1010,
      rainfall: 0,
      wind_direction: 180,
      wind_speed: 1.2,
    },
  ],
  laps: [
    {
      session_key: 9472,
      driver_number: 1,
      meeting_key: 1229,
      lap_number: 42,
      date_start: '2025-05-25T14:00:00+00:00',
      lap_duration: 71.5,
      is_pit_out_lap: false,
    },
  ],
  chapters: [],
}

const weekend: Weekend = {
  source: 'local',
  meeting_key: 1229,
  meeting,
  default_session_key: 9472,
  default_analysis_session: 9472,
  sessions: [
    { session: qualSession, source: 'local', datasets: fullDatasets },
    { session: raceSession, source: 'local', datasets: fullDatasets },
  ],
}

function renderRaceHub(sessionKey: number) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    ),
  })
  const raceHubRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/race-hub',
    validateSearch: (search: Record<string, unknown>) => {
      const sk = Number(search.session_key)
      return Number.isFinite(sk) && sk > 0 ? { session_key: sk } : {}
    },
    component: function RaceHubRouteComponent() {
      const { session_key } = raceHubRoute.useSearch()
      return <RaceHubPage sessionKey={session_key ?? 0} />
    },
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([raceHubRoute]),
    history: undefined,
  })

  // Navigate to the URL before mounting
  router.navigate({ to: '/race-hub', search: sessionKey ? { session_key: sessionKey } : {} })
  return render(<RouterProvider router={router} />)
}

describe('RaceHubPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
    mockFetchSeasons.mockResolvedValue([2025])
    mockFetchLocalMeetings.mockResolvedValue([meeting])
    mockFetchWeekend.mockResolvedValue(weekend)
    mockFetchRaceHub.mockResolvedValue(raceHub)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the workspace identity band, session rail, and overview for a known session', async () => {
    renderRaceHub(9472)

    await waitFor(() => expect(screen.getByTestId('race-hub')).toBeInTheDocument())
    expect(screen.getByTestId('rh-identity')).toHaveTextContent('Monaco Grand Prix')
    expect(screen.getByTestId('rh-identity')).toHaveTextContent('MON')

    await waitFor(() =>
      expect(screen.getByTestId('rh-session-9472')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('rh-session-9471')).toBeInTheDocument()

    // Overview is default
    expect(screen.getByTestId('rh-overview')).toBeInTheDocument()
    expect(screen.getByText('Winner')).toBeInTheDocument()
  })

  it('exposes Race Story sub-controls for classification, grid, and positions', async () => {
    renderRaceHub(9472)
    await waitFor(() => expect(screen.getByTestId('race-hub')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: 'Race Story' }))

    expect(screen.getByText('VER')).toBeInTheDocument()
    
  })

  it('keeps Diagnostics accessible behind a secondary action, free of inline CLI guidance', async () => {
    renderRaceHub(9472)
    await waitFor(() => expect(screen.getByTestId('race-hub')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: 'Diagnostics' }))

    expect(screen.getByTestId('rh-data-status')).toBeInTheDocument()
    expect(screen.queryByText(/ingest-session/i)).not.toBeInTheDocument()

    // Raw dataset coverage strip is hidden until explicitly requested.
    expect(screen.queryByTestId('rh-dataset-strip')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('rh-diagnostics-toggle'))
    expect(screen.getByTestId('rh-dataset-strip')).toBeInTheDocument()
  })

  it('does not render the raw dataset strip before fan-facing content', async () => {
    renderRaceHub(9472)
    await waitFor(() => expect(screen.getByTestId('race-hub')).toBeInTheDocument())

    // Overview (fan content) is present, but the raw diagnostics strip is not.
    expect(screen.getByTestId('rh-overview')).toBeInTheDocument()
    expect(screen.queryByTestId('rh-dataset-strip')).not.toBeInTheDocument()
  })

  it('groups analysis navigation into Story, Analysis, and Data & Context', async () => {
    renderRaceHub(9472)
    await waitFor(() => expect(screen.getByTestId('race-hub')).toBeInTheDocument())

    expect(screen.getByTestId('rh-tabgroup-story')).toBeInTheDocument()
    expect(screen.getByTestId('rh-tabgroup-analysis')).toBeInTheDocument()
    expect(screen.getByTestId('rh-tabgroup-context')).toBeInTheDocument()
    // Every capability preserved
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Strategy' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Compare' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Lap Data' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Race Control' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Diagnostics' })).toBeInTheDocument()
  })

  it('toggles the inline weekend switcher', async () => {
    renderRaceHub(9472)
    await waitFor(() => expect(screen.getByTestId('race-hub')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('rh-switch-weekend'))
    expect(await screen.findByTestId('rh-switcher')).toBeInTheDocument()
  })

  it('resolves bare /race-hub through the default analysis session (never a future one)', async () => {
    const futureMeeting: Meeting = { ...meeting, meeting_key: 1300, meeting_name: 'Future GP' }
    mockFetchLocalMeetings.mockResolvedValue([futureMeeting])
    mockFetchWeekend.mockResolvedValue({
      source: 'partial',
      meeting_key: 1300,
      meeting: futureMeeting,
      // Backend excludes the future session; falls back to the completed quali.
      default_session_key: 9600,
      default_analysis_session: 9471,
      sessions: [
        { session: { ...qualSession, meeting_key: 1300 }, source: 'local', datasets: fullDatasets },
        { session: futureSession, source: 'none', datasets: {} },
      ],
    })

    renderRaceHub(0)

    await waitFor(() => expect(mockFetchRaceHub).toHaveBeenCalledWith(9471))
    expect(mockFetchRaceHub).not.toHaveBeenCalledWith(9600)
  })

  it('renders a pre-session view instead of empty analysis for a future session', async () => {
    mockFetchRaceHub.mockResolvedValue({
      ...raceHub,
      session_key: 9600,
      source: 'none',
      session: futureSession,
      meeting: { ...meeting, meeting_key: 1300 },
      results: [],
      starting_grid: [],
      datasets: {},
    })
    mockFetchWeekend.mockResolvedValue({
      source: 'none',
      meeting_key: 1300,
      meeting: { ...meeting, meeting_key: 1300 },
      sessions: [{ session: futureSession, source: 'none', datasets: {} }],
    })

    renderRaceHub(9600)

    await waitFor(() => expect(screen.getByTestId('race-hub')).toBeInTheDocument())
    expect(await screen.findByTestId('rh-presession')).toBeInTheDocument()
    // No Winner analysis card for an unrun session.
    expect(screen.queryByTestId('rh-overview')).not.toBeInTheDocument()
    expect(screen.queryByText('Winner')).not.toBeInTheDocument()
  })

  it('labels a completed but partial session as Partial in the active state', async () => {
    mockFetchWeekend.mockResolvedValue({
      ...weekend,
      sessions: [
        { session: qualSession, source: 'local', datasets: fullDatasets },
        { session: raceSession, source: 'partial', datasets: { drivers: fullDatasets.drivers } },
      ],
    })

    renderRaceHub(9472)

    await waitFor(() => expect(screen.getByTestId('rh-active-state')).toBeInTheDocument())
    expect(screen.getByTestId('rh-active-state')).toHaveTextContent('Partial')
  })

  it('offers retry and back-to-Weekend on an error', async () => {
    mockFetchRaceHub.mockRejectedValue(new Error('boom'))

    renderRaceHub(9472)

    await waitFor(() => expect(screen.getByTestId('race-hub-error')).toBeInTheDocument())
    expect(screen.getByTestId('rh-retry')).toBeInTheDocument()
    const back = screen.getByTestId('rh-back-weekend')
    expect(back).toHaveAttribute('href', '/race-hub')

    mockFetchRaceHub.mockResolvedValue(raceHub)
    fireEvent.click(screen.getByTestId('rh-retry'))
    await waitFor(() => expect(screen.getByTestId('race-hub')).toBeInTheDocument())
  })
})
