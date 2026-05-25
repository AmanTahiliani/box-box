import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { DatasetStatusView } from '../components/DatasetStatusView'
import type { DatasetInfo } from '../types'

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

const coreOnly: Record<string, DatasetInfo> = {
  meeting: { status: 'available', source: 'local', count: 1 },
  session: { status: 'available', source: 'local', count: 1 },
  drivers: { status: 'available', source: 'local', count: 20 },
  results: { status: 'available', source: 'local', count: 20 },
  starting_grid: { status: 'available', source: 'local', count: 20 },
  stints: { status: 'missing', source: 'none' },
  pit_stops: { status: 'missing', source: 'none' },
  positions: { status: 'missing', source: 'none' },
  race_control: { status: 'missing', source: 'none' },
  weather: { status: 'missing', source: 'none' },
  laps: { status: 'missing', source: 'none' },
}

function renderView(datasets: Record<string, DatasetInfo>) {
  const rootRoute = createRootRoute({
    component: () => <DatasetStatusView datasets={datasets} />,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) })
  return render(<RouterProvider router={router} />)
}

describe('DatasetStatusView', () => {
  it('shows 11/11 when all datasets are available', async () => {
    renderView(fullDatasets)
    await waitFor(() =>
      expect(screen.getByText(/11\/11 datasets local/)).toBeInTheDocument(),
    )
  })

  it('shows a Local badge for every available dataset', async () => {
    renderView(fullDatasets)
    await waitFor(() => expect(screen.getAllByText('Local')).toHaveLength(11))
  })

  it('shows Missing badges for missing datasets', async () => {
    renderView(coreOnly)
    await waitFor(() => expect(screen.getAllByText('Missing')).toHaveLength(6))
  })

  it('links to admin when datasets are missing instead of inlining CLI commands', async () => {
    renderView(coreOnly)
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /manage ingestion/i })).toHaveAttribute(
        'href',
        '/admin',
      )
    })
    expect(screen.queryByText(/ingest-session/i)).not.toBeInTheDocument()
  })

  it('does not surface ingest hints when fully covered', async () => {
    renderView(fullDatasets)
    await waitFor(() => expect(screen.getByText(/11\/11/)).toBeInTheDocument())
    expect(screen.queryByText(/manage ingestion/i)).not.toBeInTheDocument()
  })

  it('renders record counts from the dataset payload', async () => {
    renderView(fullDatasets)
    await waitFor(() => {
      const twenties = screen.getAllByText('20')
      expect(twenties.length).toBeGreaterThan(0)
    })
  })
})
