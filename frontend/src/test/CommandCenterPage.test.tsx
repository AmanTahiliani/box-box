import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { CommandCenterPage } from '../pages/CommandCenterPage'
import type { DatasetInfo, Meeting, Weekend } from '../types'

vi.mock('../api', () => ({
  fetchSeasons: vi.fn(),
  fetchLocalMeetings: vi.fn(),
  fetchSeasonMeetings: vi.fn(),
  fetchSessions: vi.fn(),
  fetchWeekend: vi.fn(),
  fetchLiveState: vi.fn(),
  fetchChampionshipHub: vi.fn(),
  fetchRaceHub: vi.fn(),
}))

import {
  fetchSeasons,
  fetchLocalMeetings,
  fetchSeasonMeetings,
  fetchSessions,
  fetchWeekend,
  fetchLiveState,
  fetchChampionshipHub,
  fetchRaceHub,
} from '../api'

const mockFetchSeasons = vi.mocked(fetchSeasons)
const mockFetchLocalMeetings = vi.mocked(fetchLocalMeetings)
const mockFetchSeasonMeetings = vi.mocked(fetchSeasonMeetings)
const mockFetchSessions = vi.mocked(fetchSessions)
const mockFetchWeekend = vi.mocked(fetchWeekend)
const mockFetchLiveState = vi.mocked(fetchLiveState)
const mockFetchChampionshipHub = vi.mocked(fetchChampionshipHub)
const mockFetchRaceHub = vi.mocked(fetchRaceHub)

const meeting: Meeting = {
  meeting_key: 1229,
  meeting_name: 'Monaco',
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

const fullDatasets: Record<string, DatasetInfo> = {
  meeting: { status: 'available', source: 'local', count: 1 },
  session: { status: 'available', source: 'local', count: 1 },
  drivers: { status: 'available', source: 'local', count: 20 },
  results: { status: 'available', source: 'local', count: 20 },
  starting_grid: { status: 'available', source: 'local', count: 20 },
  stints: { status: 'available', source: 'local', count: 2 },
  pit_stops: { status: 'available', source: 'local', count: 1 },
  positions: { status: 'available', source: 'local', count: 3 },
  race_control: { status: 'available', source: 'local', count: 1 },
  weather: { status: 'available', source: 'local', count: 1 },
  laps: { status: 'available', source: 'local', count: 1 },
}

const weekend: Weekend = {
  source: 'local',
  meeting_key: 1229,
  meeting,
  default_session_key: 9472,
  sessions: [
    {
      session: {
        session_key: 9472,
        session_name: 'Race',
        session_type: 'Race',
        meeting_key: 1229,
        date_start: '2025-05-25T13:00:00+00:00',
        date_end: '2025-05-25T15:00:00+00:00',
        gmt_offset: '02:00:00',
      },
      source: 'local',
      datasets: fullDatasets,
    },
  ],
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <CommandCenterPage />
      </QueryClientProvider>
    ),
  })

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: CommandCenterPage,
  })

  const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) })

  return render(<RouterProvider router={router} />)
}

describe('CommandCenterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchLiveState.mockResolvedValue({ is_live: false, data: null })
    mockFetchSessions.mockResolvedValue([])
    mockFetchChampionshipHub.mockResolvedValue({
      season: 2025,
      round: 1,
      total_rounds: 1,
      rounds_left: 0,
      last_race: 'Monaco',
      round_labels: ['R1'],
      drivers: [],
      teams: [],
    })
    mockFetchRaceHub.mockResolvedValue({
      source: 'local',
      session_key: 9472,
      datasets: fullDatasets,
      results: [
        {
          driver_number: 1,
          position: 1,
          name_acronym: 'VER',
          full_name: 'Max Verstappen',
          team_name: 'Red Bull Racing',
          team_colour: '3671c6',
          dnf: false,
          dns: false,
          dsq: false,
          duration: 7200,
          gap_to_leader: null,
          number_of_laps: 78,
          points: 25,
          session_key: 9472,
          meeting_key: 1229,
        },
      ],
      starting_grid: [],
      drivers: [],
      stints: [],
      pit_stops: [],
      positions: [],
      race_control: [],
      weather: [],
      laps: [],
      chapters: [],
    })
  })

  it('shows empty state when no seasons are ingested', async () => {
    mockFetchSeasons.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('command-center-empty')).toBeInTheDocument()
    })
    expect(screen.getByText('No local data yet')).toBeInTheDocument()
  })

  it('shows weekend identity band and schedule when data exists', async () => {
    mockFetchSeasons.mockResolvedValue([2025])
    mockFetchLocalMeetings.mockResolvedValue([meeting])
    mockFetchSeasonMeetings.mockResolvedValue([meeting])
    mockFetchWeekend.mockResolvedValue(weekend)

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('command-center')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByTestId('cc-session-9472')).toBeInTheDocument()
    })
    expect(screen.getByTestId('cc-focus')).toHaveTextContent('Monaco')
    expect(screen.getByTestId('cc-season-calendar')).toHaveTextContent('Season Calendar')
    expect(screen.getByTestId('cc-calendar-1229')).toHaveTextContent('R01')
    expect(screen.getByText('No live session')).toBeInTheDocument()
    expect(screen.getByTestId('hero-last-race-link')).toHaveTextContent('Monaco')
  })

  it('uses OpenF1 calendar metadata to focus the current weekend when local ingest is behind', async () => {
    const canada = {
      ...meeting,
      meeting_key: 1301,
      meeting_name: 'Canada',
      country_name: 'Canada',
      country_code: 'CAN',
      circuit_short_name: 'Montreal',
      date_start: '2026-05-22T00:00:00+00:00',
      date_end: '2026-05-24T23:59:59+00:00',
      year: 2026,
    }
    const monaco = {
      ...meeting,
      meeting_key: 1302,
      meeting_name: 'Monaco',
      date_start: '2026-06-05T00:00:00+00:00',
      date_end: '2026-06-07T23:59:59+00:00',
      year: 2026,
    }

    vi.setSystemTime(new Date('2026-06-06T15:15:00Z'))
    mockFetchSeasons.mockResolvedValue([2026])
    mockFetchLocalMeetings.mockResolvedValue([canada])
    mockFetchSeasonMeetings.mockResolvedValue([canada, monaco])
    mockFetchWeekend.mockResolvedValue({ ...weekend, meeting: canada, meeting_key: canada.meeting_key })
    mockFetchSessions.mockResolvedValue([
      {
        session_key: 9602,
        session_name: 'Qualifying',
        session_type: 'Qualifying',
        meeting_key: monaco.meeting_key,
        date_start: '2026-06-06T15:00:00+00:00',
        date_end: '2026-06-06T16:00:00+00:00',
        gmt_offset: '02:00:00',
      },
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('cc-focus')).toHaveTextContent('Monaco')
    })
    expect(screen.getByTestId('cc-focus')).toHaveTextContent('Live now')
    expect(screen.getByTestId('cc-session-9602')).toHaveTextContent('On track')
    expect(screen.getByTestId('hero-live-link')).toHaveAttribute('href', '/live')

    vi.useRealTimers()
  })
})
