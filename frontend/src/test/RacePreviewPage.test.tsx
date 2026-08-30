import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { RacePreviewPage } from '../pages/RacePreviewPage'
import type { ChampHubDriver, ChampionshipHub, EnrichedGrid, EnrichedResult, Meeting, Session, TrackOutline } from '../types'

vi.mock('../api', () => ({
  fetchSeasons: vi.fn(),
  fetchMeetings: vi.fn(),
  fetchSessions: vi.fn(),
  fetchResults: vi.fn(),
  fetchStartingGrid: vi.fn(),
  fetchTrackOutline: vi.fn(),
  fetchChampionshipHub: vi.fn(),
}))

import {
  fetchSeasons,
  fetchMeetings,
  fetchSessions,
  fetchResults,
  fetchStartingGrid,
  fetchTrackOutline,
  fetchChampionshipHub,
} from '../api'

const mockFetchSeasons = vi.mocked(fetchSeasons)
const mockFetchMeetings = vi.mocked(fetchMeetings)
const mockFetchSessions = vi.mocked(fetchSessions)
const mockFetchResults = vi.mocked(fetchResults)
const mockFetchStartingGrid = vi.mocked(fetchStartingGrid)
const mockFetchTrackOutline = vi.mocked(fetchTrackOutline)
const mockFetchChampionshipHub = vi.mocked(fetchChampionshipHub)

const upcomingMeeting: Meeting = {
  meeting_key: 100,
  meeting_name: 'Monaco',
  meeting_official_name: 'Monaco GP',
  location: 'Monaco',
  country_name: 'Monaco',
  country_code: 'MON',
  country_flag: '',
  circuit_key: 10,
  circuit_short_name: 'Monaco',
  date_start: '2099-05-22T00:00:00+00:00',
  date_end: '2099-05-24T23:59:59+00:00',
  year: 2099,
}

const priorMeeting: Meeting = {
  ...upcomingMeeting,
  meeting_key: 90,
  year: 2098,
  date_start: '2098-05-22T00:00:00+00:00',
  date_end: '2098-05-24T23:59:59+00:00',
}

const sessions: Session[] = [
  {
    session_key: 1,
    session_name: 'FP1',
    session_type: 'Practice',
    meeting_key: 100,
    date_start: '2099-05-22T10:00:00+00:00',
    date_end: '2099-05-22T11:00:00+00:00',
    gmt_offset: '02:00:00',
  },
  {
    session_key: 2,
    session_name: 'Sprint',
    session_type: 'Sprint',
    meeting_key: 100,
    date_start: '2099-05-23T10:00:00+00:00',
    date_end: '2099-05-23T11:00:00+00:00',
    gmt_offset: '02:00:00',
  },
  {
    session_key: 3,
    session_name: 'Race',
    session_type: 'Race',
    meeting_key: 100,
    date_start: '2099-05-24T13:00:00+00:00',
    date_end: '2099-05-24T15:00:00+00:00',
    gmt_offset: '02:00:00',
  },
]

const priorRaceSession: Session = {
  session_key: 50,
  session_name: 'Race',
  session_type: 'Race',
  meeting_key: 90,
  date_start: '2098-05-24T13:00:00+00:00',
  date_end: '2098-05-24T15:00:00+00:00',
  gmt_offset: '02:00:00',
}

const hubDriver = (over: Partial<ChampHubDriver>): ChampHubDriver => ({
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
  form: [25],
  cumulative: [200],
  round_positions: [1],
  teammate_wins: 9,
  teammate_losses: 1,
  ...over,
})

const hub: ChampionshipHub = {
  season: 2099,
  round: 5,
  total_rounds: 24,
  rounds_left: 19,
  last_race: 'Monaco GP',
  round_labels: ['R1'],
  drivers: [
    hubDriver({}),
    hubDriver({ driver_number: 4, name_acronym: 'NOR', points: 160, position: 2 }),
    hubDriver({ driver_number: 16, name_acronym: 'LEC', points: 120, position: 3 }),
  ],
  teams: [],
}

const results: EnrichedResult[] = [
  {
    driver_number: 1,
    position: 1,
    name_acronym: 'VER',
    full_name: 'Max Verstappen',
    team_name: 'Red Bull',
    team_colour: '3671c6',
    dnf: false,
    dns: false,
    dsq: false,
    duration: 100,
    gap_to_leader: 0,
    number_of_laps: 78,
    points: 25,
    session_key: 50,
    meeting_key: 90,
  },
]

const grid: EnrichedGrid[] = [
  {
    driver_number: 4,
    position: 1,
    name_acronym: 'NOR',
    full_name: 'Lando Norris',
    team_name: 'McLaren',
    team_colour: 'ff8000',
    session_key: 50,
    meeting_key: 90,
    lap_duration: 70,
  },
]

const outline: TrackOutline = {
  circuit_key: 10,
  points: [
    { x: 0.1, y: 0.2 },
    { x: 0.5, y: 0.5 },
    { x: 0.9, y: 0.8 },
  ],
  bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <RacePreviewPage />
      </QueryClientProvider>
    ),
  })
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: RacePreviewPage })
  const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) })
  return render(<RouterProvider router={router} />)
}

describe('RacePreviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSeasons.mockResolvedValue([2099])
    mockFetchChampionshipHub.mockResolvedValue(hub)
    mockFetchTrackOutline.mockResolvedValue(outline)
    mockFetchResults.mockResolvedValue(results)
    mockFetchStartingGrid.mockResolvedValue(grid)
  })

  it('renders upcoming race preview with sections', async () => {
    mockFetchMeetings.mockImplementation(async (year: number) => {
      if (year === 2099) return [upcomingMeeting]
      if (year === 2098) return [priorMeeting]
      return []
    })
    mockFetchSessions.mockImplementation(async (meetingKey: number) => {
      if (meetingKey === 100) return sessions
      if (meetingKey === 90) return [priorRaceSession]
      return []
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('preview-page')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByTestId('preview-countdown')).toBeInTheDocument()
    })

    expect(screen.getByTestId('preview-header')).toHaveTextContent('Monaco')
    expect(screen.getByTestId('preview-schedule')).toHaveTextContent('FP1')
    expect(screen.getByTestId('preview-track-card')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Circuit outline' })).toBeInTheDocument()
    expect(screen.queryByTestId('preview-track-fallback')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('preview-last-year-card')).toHaveTextContent('VER')
    })

    expect(screen.getByTestId('preview-title-fight-card')).toHaveTextContent('NOR')
    expect(screen.getByTestId('preview-sprint-note')).toBeInTheDocument()
  })

  it('renders season-over state when no upcoming meeting', async () => {
    mockFetchMeetings.mockResolvedValue([
      {
        ...upcomingMeeting,
        date_start: '2020-05-22T00:00:00+00:00',
        date_end: '2020-05-24T23:59:59+00:00',
      },
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('preview-season-over')).toBeInTheDocument()
    })

    expect(screen.getByText('Season complete')).toBeInTheDocument()
    expect(screen.getByTestId('preview-title-fight-card')).toBeInTheDocument()
    expect(screen.queryByTestId('preview-header')).not.toBeInTheDocument()
  })

  it('shows first-time circuit empty state', async () => {
    const newCircuit: Meeting = {
      ...upcomingMeeting,
      meeting_key: 200,
      circuit_key: 999,
      meeting_name: 'New GP',
    }

    mockFetchMeetings.mockImplementation(async (year: number) => {
      if (year === 2099) return [newCircuit]
      if (year === 2098) return [priorMeeting]
      return []
    })
    mockFetchSessions.mockResolvedValue(sessions)
    mockFetchTrackOutline.mockResolvedValue(null)

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('preview-last-year-card')).toHaveTextContent('First time on the calendar')
    })

    const fallback = screen.getByTestId('preview-track-fallback')
    expect(screen.getByTestId('preview-track-card')).toContainElement(fallback)
    expect(fallback).toHaveTextContent('Monaco')
    expect(fallback).toHaveTextContent('A GPS track outline is not available in the local cache.')
    expect(screen.queryByRole('img', { name: 'Circuit outline' })).not.toBeInTheDocument()
  })

  it('shows a designed circuit fallback when the track outline is unavailable', async () => {
    const italianGp: Meeting = {
      ...upcomingMeeting,
      meeting_name: 'Italian Grand Prix',
      meeting_official_name: 'Formula 1 Pirelli Gran Premio d\'Italia',
      location: 'Monza',
      country_name: 'Italy',
      country_code: 'ITA',
      circuit_short_name: 'Monza',
    }

    mockFetchMeetings.mockImplementation(async (year: number) => {
      if (year === 2099) return [italianGp]
      if (year === 2098) return [{ ...italianGp, meeting_key: 90, year: 2098 }]
      return []
    })
    mockFetchSessions.mockImplementation(async (meetingKey: number) => {
      if (meetingKey === 100) return sessions
      if (meetingKey === 90) return [priorRaceSession]
      return []
    })
    mockFetchTrackOutline.mockResolvedValue(null)

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('preview-track-fallback')).toBeInTheDocument()
    })

    const card = screen.getByTestId('preview-track-card')
    const fallback = screen.getByTestId('preview-track-fallback')
    expect(card).toContainElement(fallback)
    expect(card).toHaveTextContent('Circuit')
    expect(fallback).toHaveTextContent('Monza')
    expect(fallback).toHaveTextContent('Italy')
    expect(fallback).toHaveTextContent('A GPS track outline is not available in the local cache.')
    expect(fallback).not.toHaveTextContent(/unknown/i)
    expect(screen.queryByRole('img', { name: 'Circuit outline' })).not.toBeInTheDocument()
    expect(card).not.toHaveTextContent('Track outline unavailable for this circuit')
  })

  it('keeps a thrown outline request distinct from the designed unavailable state', async () => {
    mockFetchMeetings.mockImplementation(async (year: number) => {
      if (year === 2099) return [upcomingMeeting]
      if (year === 2098) return [priorMeeting]
      return []
    })
    mockFetchSessions.mockImplementation(async (meetingKey: number) => {
      if (meetingKey === 100) return sessions
      if (meetingKey === 90) return [priorRaceSession]
      return []
    })
    mockFetchTrackOutline.mockRejectedValue(new Error('outline request failed'))

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('preview-track-card')).toHaveTextContent('outline request failed')
    })

    expect(screen.queryByTestId('preview-track-fallback')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Circuit outline' })).not.toBeInTheDocument()
  })
})
