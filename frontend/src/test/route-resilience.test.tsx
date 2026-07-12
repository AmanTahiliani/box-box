import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { DriverProfilePage } from '../pages/DriverProfilePage'
import { ApiError } from '../lib/fetch'
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
  rounds: [],
  source: 'local',
  enrichment: 'limited',
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

describe('DriverProfilePage resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSeasons.mockResolvedValue([2025])
  })

  it('leaves loading after a timeout error and offers retry', async () => {
    mockFetchSummary.mockRejectedValue(
      new ApiError('timeout', 'Request timed out', {
        userMessage: 'This request took too long. Check your connection, then retry.',
      }),
    )

    renderPage({ driverNumber: 1, year: 2025 })

    await waitFor(() => {
      expect(screen.getByTestId('driver-profile-error')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('driver-profile-loading')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByTestId('driver-profile-error')).toHaveTextContent(/took too long/i)
  })

  it('dedupes concurrent retries via a single refetch gate', async () => {
    let calls = 0
    mockFetchSummary.mockImplementation(async () => {
      calls += 1
      if (calls === 1) {
        throw new ApiError('http', 'boom', { status: 500 })
      }
      return summary
    })

    renderPage({ driverNumber: 1, year: 2025 })
    await waitFor(() => expect(screen.getByTestId('driver-profile-error')).toBeInTheDocument())

    const retry = screen.getByRole('button', { name: 'Retry' })
    fireEvent.click(retry)
    fireEvent.click(retry)

    await waitFor(() => expect(screen.getByTestId('driver-profile')).toBeInTheDocument())
    expect(calls).toBe(2)
    expect(screen.getByTestId('driver-profile-limited')).toBeInTheDocument()
  })
})
