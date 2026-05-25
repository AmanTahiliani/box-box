import { describe, it, expect, vi, beforeEach } from 'vitest'
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
}

const weekend: Weekend = {
  source: 'local',
  meeting_key: 1229,
  meeting,
  default_session_key: 9472,
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
    mockFetchSeasons.mockResolvedValue([2025])
    mockFetchLocalMeetings.mockResolvedValue([meeting])
    mockFetchWeekend.mockResolvedValue(weekend)
    mockFetchRaceHub.mockResolvedValue(raceHub)
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

    expect(screen.getByRole('tab', { name: 'Classification' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Starting Grid' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Positions' })).toBeInTheDocument()
    expect(screen.getByText('Final Classification')).toBeInTheDocument()
  })

  it('keeps Data Status accessible and free of inline CLI guidance', async () => {
    renderRaceHub(9472)
    await waitFor(() => expect(screen.getByTestId('race-hub')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: 'Data Status' }))

    expect(screen.getByTestId('rh-data-status')).toBeInTheDocument()
    expect(screen.queryByText(/ingest-session/i)).not.toBeInTheDocument()
  })

  it('toggles the inline weekend switcher', async () => {
    renderRaceHub(9472)
    await waitFor(() => expect(screen.getByTestId('race-hub')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('rh-switch-weekend'))
    expect(await screen.findByTestId('rh-switcher')).toBeInTheDocument()
  })
})
