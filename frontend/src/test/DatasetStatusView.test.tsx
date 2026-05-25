import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DatasetStatusView } from '../components/DatasetStatusView'
import type { DatasetInfo } from '../types'

const allAvailable: Record<string, DatasetInfo> = {
  meeting: { status: 'available', source: 'local', count: 1 },
  session: { status: 'available', source: 'local', count: 1 },
  drivers: { status: 'available', source: 'local', count: 20 },
  results: { status: 'available', source: 'local', count: 20 },
  starting_grid: { status: 'available', source: 'local', count: 20 },
}

const partial: Record<string, DatasetInfo> = {
  meeting: { status: 'available', source: 'local', count: 1 },
  session: { status: 'available', source: 'local', count: 1 },
  drivers: { status: 'missing', source: 'none' },
  results: { status: 'missing', source: 'none' },
  starting_grid: { status: 'missing', source: 'none' },
}

describe('DatasetStatusView', () => {
  it('shows 5/5 when all available', () => {
    render(<DatasetStatusView datasets={allAvailable} />)
    expect(screen.getByText(/5\/5/)).toBeInTheDocument()
  })

  it('shows local badges for available datasets', () => {
    render(<DatasetStatusView datasets={allAvailable} />)
    const localBadges = screen.getAllByText('Local')
    expect(localBadges).toHaveLength(5)
  })

  it('shows missing badges for missing datasets', () => {
    render(<DatasetStatusView datasets={partial} />)
    const missingBadges = screen.getAllByText('Missing')
    expect(missingBadges).toHaveLength(3)
  })

  it('shows the ingest command when data is missing', () => {
    render(<DatasetStatusView datasets={partial} />)
    expect(screen.getByText(/ingest-session/i)).toBeInTheDocument()
  })

  it('does not show ingest command when all available', () => {
    render(<DatasetStatusView datasets={allAvailable} />)
    expect(screen.queryByText(/ingest-session/i)).not.toBeInTheDocument()
  })

  it('shows record counts', () => {
    render(<DatasetStatusView datasets={allAvailable} />)
    const twenties = screen.getAllByText('20')
    expect(twenties.length).toBeGreaterThan(0)
  })
})
