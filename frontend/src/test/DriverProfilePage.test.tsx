import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { DriverProfilePage } from '../pages/DriverProfilePage'
import type { DriverSummary } from '../types'

vi.mock('../api', () => ({
  fetchSeasons: vi.fn(),
  fetchDriverSummary: vi.fn(),
}))

import { fetchSeasons, fetchDriverSummary } from '../api'

const mockFetchSeasons = vi.mocked(fetchSeasons)
const mockFetchSummary = vi.mocked(fetchDriverSummary)

const summary: DriverSummary = {
  season: 2025,
  driver_number: 1,
  name_acronym: 'VER',
  full_name: 'Max Verstappen',
  team_name: 'Red Bull',
  team_colour: '3671c6',
  headshot_url: '',
  points: 50,
  position: 1,
  wins: 2,
  podiums: 2,
  poles: 1,
  form: [25, 25],
  cumulative: [25, 50],
  round_labels: ['R1', 'R2'],
  rounds: [
    {
      meeting_key: 1201,
      meeting_name: 'Bahrain Grand Prix',
      country_code: 'BHR',
      country_name: 'Bahrain',
      race_position: 1,
      grid_position: 1,
      quali_position: 1,
      points: 25,
      dnf: false,
      dns: false,
      dsq: false,
    },
    {
      meeting_key: 1202,
      meeting_name: 'Saudi Arabian Grand Prix',
      country_code: 'SAU',
      country_name: 'Saudi Arabia',
      race_position: 1,
      grid_position: 4,
      quali_position: 4,
      points: 25,
      dnf: false,
      dns: false,
      dsq: false,
    },
  ],
}

function renderPage(props: { driverNumber: number; year?: number }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <DriverProfilePage driverNumber={props.driverNumber} year={props.year} />
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

describe('DriverProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSeasons.mockResolvedValue([2025])
    mockFetchSummary.mockResolvedValue(summary)
  })

  it('renders header, form, quali-vs-race, and rounds sections', async () => {
    renderPage({ driverNumber: 1, year: 2025 })

    await waitFor(() => {
      expect(screen.getByTestId('driver-profile')).toBeInTheDocument()
    })

    // Header: identity + season stats.
    expect(screen.getByTestId('dp-header')).toBeInTheDocument()
    expect(screen.getByText('Max Verstappen')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('Red Bull', { exact: false })).toBeInTheDocument()
    // 'P1' / '50' also appear in the rounds table and chart axis.
    expect(screen.getAllByText('P1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('50').length).toBeGreaterThan(0)

    // Season form strip.
    expect(screen.getByTestId('dp-form')).toBeInTheDocument()
    expect(screen.getByText('Cumulative points')).toBeInTheDocument()

    // Quali-vs-race chart shows the delta from the Saudi round (P4 → P1 = +3).
    expect(screen.getByTestId('dp-quali-race')).toBeInTheDocument()
    expect(screen.getAllByText('+3').length).toBeGreaterThan(0)

    // Track-by-track table rows with flags.
    const rounds = screen.getByTestId('dp-rounds')
    expect(rounds).toBeInTheDocument()
    expect(screen.getByText('Bahrain Grand Prix')).toBeInTheDocument()
    expect(screen.getByText('Saudi Arabian Grand Prix')).toBeInTheDocument()
    expect(rounds.textContent).toContain('🇧🇭')
    expect(rounds.textContent).toContain('🇸🇦')

    // With an explicit year, the seasons list is not needed.
    expect(mockFetchSeasons).not.toHaveBeenCalled()
    expect(mockFetchSummary).toHaveBeenCalledWith(1, 2025)
  })

  it('defaults to the latest season when no year is given', async () => {
    renderPage({ driverNumber: 1 })

    await waitFor(() => {
      expect(screen.getByTestId('driver-profile')).toBeInTheDocument()
    })
    expect(mockFetchSummary).toHaveBeenCalledWith(1, 2025)
  })

  it('shows the API error message on failure', async () => {
    mockFetchSummary.mockRejectedValue(new Error('API 404: Not Found'))
    renderPage({ driverNumber: 99, year: 2025 })

    await waitFor(() => {
      expect(screen.getByText('API 404: Not Found')).toBeInTheDocument()
    })
  })

  it('shows empty states when no rounds are completed', async () => {
    mockFetchSummary.mockResolvedValue({
      ...summary,
      form: [],
      cumulative: [],
      round_labels: [],
      rounds: [],
    })
    renderPage({ driverNumber: 1, year: 2025 })

    await waitFor(() => {
      expect(screen.getByTestId('driver-profile')).toBeInTheDocument()
    })
    expect(screen.getAllByText('No completed rounds yet.').length).toBe(2)
    expect(screen.getByText('No grid-vs-finish data yet.')).toBeInTheDocument()
  })
})
