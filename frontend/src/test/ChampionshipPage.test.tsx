import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { ChampionshipPage } from '../pages/ChampionshipPage'
import type { ChampHubDriver, ChampHubTeam, ChampionshipHub } from '../types'

vi.mock('../api', () => ({
  fetchSeasons: vi.fn(),
  fetchChampionshipHub: vi.fn(),
}))

import { fetchSeasons, fetchChampionshipHub } from '../api'

const mockFetchSeasons = vi.mocked(fetchSeasons)
const mockFetchHub = vi.mocked(fetchChampionshipHub)

function driver(over: Partial<ChampHubDriver>): ChampHubDriver {
  return {
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
    teammate_wins: 9,
    teammate_losses: 1,
    ...over,
  }
}

const drivers: ChampHubDriver[] = [
  driver({ driver_number: 1, name_acronym: 'VER', team_name: 'Red Bull', points: 200, position: 1 }),
  driver({
    driver_number: 4,
    name_acronym: 'NOR',
    full_name: 'Lando Norris',
    team_name: 'McLaren',
    team_colour: 'ff8000',
    points: 160,
    position: 2,
    wins: 3,
    cumulative: [18, 36, 54, 80, 120, 160],
  }),
  driver({
    driver_number: 16,
    name_acronym: 'LEC',
    full_name: 'Charles Leclerc',
    team_name: 'Ferrari',
    team_colour: 'e8002d',
    points: 120,
    position: 3,
    wins: 1,
    cumulative: [15, 28, 40, 60, 90, 120],
  }),
]

const teams: ChampHubTeam[] = [
  { team_name: 'Red Bull', team_colour: '3671c6', points: 260, position: 1, wins: 6 },
  { team_name: 'McLaren', team_colour: 'ff8000', points: 220, position: 2, wins: 3 },
  { team_name: 'Ferrari', team_colour: 'e8002d', points: 180, position: 3, wins: 1 },
]

const hub: ChampionshipHub = {
  season: 2025,
  round: 6,
  total_rounds: 10,
  rounds_left: 4,
  last_race: 'Monaco GP',
  round_labels: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'],
  drivers,
  teams,
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <ChampionshipPage />
      </QueryClientProvider>
    ),
  })
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: ChampionshipPage })
  const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) })
  return render(<RouterProvider router={router} />)
}

describe('ChampionshipPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    mockFetchSeasons.mockResolvedValue([2025])
    mockFetchHub.mockResolvedValue(hub)
  })

  it('renders the drivers view with leader and title math', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('championship')).toBeInTheDocument()
    })

    expect(screen.getByTestId('champ-view-drivers')).toBeInTheDocument()
    // Leader code shows in the stat rail and the table.
    expect(screen.getAllByText('VER').length).toBeGreaterThan(0)
    expect(screen.getByText('Monaco GP', { exact: false })).toBeInTheDocument()
    expect(screen.getByTestId('champ-titlemath')).toHaveTextContent('mathematically win the title')
    expect(screen.getAllByText('~10 pts/round').length).toBeGreaterThan(0)
  })

  it('switches to constructors and progression views', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByTestId('championship')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('champ-tab-constructors'))
    expect(screen.getByTestId('champ-view-constructors')).toBeInTheDocument()
    expect(screen.getAllByText('Red Bull', { exact: false }).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByTestId('champ-tab-progression'))
    expect(screen.getByTestId('champ-view-progression')).toBeInTheDocument()
    expect(screen.getByText('Cumulative points', { exact: false })).toBeInTheDocument()
  })

  it('switches to the simulator view and projects standings', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByTestId('championship')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('champ-tab-simulator'))
    expect(screen.getByTestId('champ-view-simulator')).toBeInTheDocument()
    expect(screen.getByTestId('sim-projected')).toBeInTheDocument()
    // 4 rounds left, default scenario: VER projects to 200 + 4×25 = 300.
    expect(screen.getByText('300')).toBeInTheDocument()
  })

  it('shows the empty state when no drivers are returned', async () => {
    mockFetchHub.mockResolvedValue({ ...hub, drivers: [], teams: [] })
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('championship-empty')).toBeInTheDocument()
    })
    expect(screen.getByText('No championship data')).toBeInTheDocument()
  })

  it('renders teammate battles section ordered by closest split', async () => {
    const h2hDrivers: ChampHubDriver[] = [
      driver({ driver_number: 1, name_acronym: 'VER', team_name: 'Red Bull', points: 200, position: 1 }),
      driver({
        driver_number: 4,
        name_acronym: 'NOR',
        full_name: 'Lando Norris',
        team_name: 'McLaren',
        team_colour: 'ff8000',
        points: 160,
        position: 2,
        teammate_wins: 6,
        teammate_losses: 5,
        cumulative: [18, 36, 54, 80, 120, 160],
      }),
      driver({
        driver_number: 81,
        name_acronym: 'PIA',
        full_name: 'Oscar Piastri',
        team_name: 'McLaren',
        team_colour: 'ff8000',
        points: 140,
        position: 3,
        teammate_wins: 5,
        teammate_losses: 6,
        cumulative: [12, 28, 45, 70, 110, 140],
      }),
      driver({
        driver_number: 11,
        name_acronym: 'PER',
        full_name: 'Sergio Perez',
        team_name: 'Red Bull',
        team_colour: '3671c6',
        points: 60,
        position: 4,
        teammate_wins: 1,
        teammate_losses: 9,
        cumulative: [5, 12, 20, 35, 50, 60],
      }),
    ]
    mockFetchHub.mockResolvedValue({ ...hub, drivers: h2hDrivers })
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('champ-teammate-battles')).toBeInTheDocument()
    })

    expect(screen.getByText('Teammate battles')).toBeInTheDocument()
    const rows = screen.getAllByTestId('teammate-h2h')
    expect(rows).toHaveLength(2)
    // McLaren 6–5 is closer than Red Bull 9–1 — McLaren row first.
    expect(rows[0]).toHaveTextContent('McLaren')
    expect(rows[0]).toHaveTextContent('6–5')
    expect(rows[1]).toHaveTextContent('Red Bull')
    expect(rows[1]).toHaveTextContent('9–1')
  })
})
