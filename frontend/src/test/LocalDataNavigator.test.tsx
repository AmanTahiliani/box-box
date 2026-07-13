import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { LocalDataNavigator, countRaceHubDatasets, formatCoverageHint } from '../components/LocalDataNavigator'
import type { DatasetInfo, Meeting, Weekend } from '../types'

vi.mock('../api', () => ({
  fetchSeasons: vi.fn(),
  fetchLocalMeetings: vi.fn(),
  fetchWeekend: vi.fn(),
}))

import { fetchSeasons, fetchLocalMeetings, fetchWeekend } from '../api'

const mockFetchSeasons = vi.mocked(fetchSeasons)
const mockFetchLocalMeetings = vi.mocked(fetchLocalMeetings)
const mockFetchWeekend = vi.mocked(fetchWeekend)

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

function renderWithProviders(onSelectSession?: (sessionKey: number) => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <LocalDataNavigator onSelectSession={onSelectSession} />
      </QueryClientProvider>
    ),
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) })

  return render(<RouterProvider router={router} />)
}

describe('navigation helpers', () => {
  it('counts available Race Hub datasets', () => {
    expect(countRaceHubDatasets(fullDatasets)).toEqual({ available: 11, total: 11 })
    expect(countRaceHubDatasets({ meeting: { status: 'available', source: 'local' } })).toEqual({
      available: 1,
      total: 11,
    })
  })

  it('formats coverage hint', () => {
    expect(formatCoverageHint(fullDatasets)).toBe('11/11')
  })
})

describe('LocalDataNavigator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when no seasons exist', async () => {
    mockFetchSeasons.mockResolvedValue([])

    renderWithProviders()

    expect(await screen.findByTestId('local-nav-empty')).toBeInTheDocument()
    expect(screen.getByText(/No ingested seasons yet/i)).toBeInTheDocument()
  })

  it('loads meetings for the first season by default', async () => {
    mockFetchSeasons.mockResolvedValue([2025])
    mockFetchLocalMeetings.mockResolvedValue([meeting])

    renderWithProviders()

    expect(await screen.findByTestId('local-nav')).toBeInTheDocument()
    await waitFor(() => {
      expect(mockFetchLocalMeetings).toHaveBeenCalledWith(2025, expect.any(AbortSignal))
    })
    expect(screen.getByText('Monaco')).toBeInTheDocument()
  })

  it('loads weekend sessions and calls onSelectSession', async () => {
    const onSelectSession = vi.fn()

    mockFetchSeasons.mockResolvedValue([2025])
    mockFetchLocalMeetings.mockResolvedValue([meeting])
    mockFetchWeekend.mockResolvedValue(weekend)

    renderWithProviders(onSelectSession)

    await screen.findByText('Monaco')
    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }))

    expect(await screen.findByTestId('weekend-sessions')).toBeInTheDocument()
    expect(screen.getByText('11/11')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('open-session-9472'))
    expect(onSelectSession).toHaveBeenCalledWith(9472)
  })
})
