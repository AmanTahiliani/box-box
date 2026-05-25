import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClassificationTable } from '../components/ClassificationTable'
import type { EnrichedResult, EnrichedGrid } from '../types'

const mockResults: EnrichedResult[] = [
  {
    driver_number: 16,
    position: 1,
    name_acronym: 'LEC',
    full_name: 'Charles Leclerc',
    team_name: 'Ferrari',
    team_colour: 'e8002d',
    dnf: false,
    dns: false,
    dsq: false,
    duration: 5534.456,
    gap_to_leader: null,
    number_of_laps: 78,
    points: 25,
    session_key: 9472,
    meeting_key: 1234,
  },
  {
    driver_number: 1,
    position: 2,
    name_acronym: 'VER',
    full_name: 'Max Verstappen',
    team_name: 'Red Bull Racing',
    team_colour: '3671c6',
    dnf: false,
    dns: false,
    dsq: false,
    duration: null,
    gap_to_leader: 3.456,
    number_of_laps: 78,
    points: 18,
    session_key: 9472,
    meeting_key: 1234,
  },
  {
    driver_number: 44,
    position: 5,
    name_acronym: 'HAM',
    full_name: 'Lewis Hamilton',
    team_name: 'Ferrari',
    team_colour: 'e8002d',
    dnf: false,
    dns: false,
    dsq: false,
    duration: null,
    gap_to_leader: 21.234,
    number_of_laps: 78,
    points: 10,
    session_key: 9472,
    meeting_key: 1234,
  },
]

const mockGrid: EnrichedGrid[] = [
  {
    driver_number: 1,
    position: 1,
    name_acronym: 'VER',
    full_name: 'Max Verstappen',
    team_name: 'Red Bull Racing',
    team_colour: '3671c6',
    session_key: 9472,
    meeting_key: 1234,
    lap_duration: 74.892,
  },
  {
    driver_number: 16,
    position: 3,
    name_acronym: 'LEC',
    full_name: 'Charles Leclerc',
    team_name: 'Ferrari',
    team_colour: 'e8002d',
    session_key: 9472,
    meeting_key: 1234,
    lap_duration: 75.123,
  },
]

describe('ClassificationTable', () => {
  it('renders driver acronyms', () => {
    render(<ClassificationTable results={mockResults} grid={mockGrid} />)
    expect(screen.getByText('LEC')).toBeInTheDocument()
    expect(screen.getByText('VER')).toBeInTheDocument()
    expect(screen.getByText('HAM')).toBeInTheDocument()
  })

  it('renders P1 badge for LEC', () => {
    const { container } = render(<ClassificationTable results={mockResults} grid={mockGrid} />)
    const p1 = container.querySelector('.pos-p1')
    expect(p1).toBeInTheDocument()
    expect(p1?.textContent).toBe('1')
  })

  it('shows grid gain arrow for LEC (started P3, finished P1)', () => {
    render(<ClassificationTable results={mockResults} grid={mockGrid} />)
    expect(screen.getByText('↑2')).toBeInTheDocument()
  })

  it('shows grid loss arrow for VER (started P1, finished P2)', () => {
    render(<ClassificationTable results={mockResults} grid={mockGrid} />)
    expect(screen.getByText('↓1')).toBeInTheDocument()
  })

  it('renders missing notice when results are empty', () => {
    render(<ClassificationTable results={[]} grid={[]} />)
    expect(screen.getByText(/not ingested/i)).toBeInTheDocument()
  })
})

describe('ClassificationTable — DNF/DNS/DSQ', () => {
  it('shows DNF label', () => {
    const dnfResult: EnrichedResult = {
      ...mockResults[0],
      driver_number: 23,
      name_acronym: 'ALB',
      position: 20,
      dnf: true,
      duration: null,
      gap_to_leader: null,
      points: 0,
    }
    render(<ClassificationTable results={[dnfResult]} grid={[]} />)
    expect(screen.getByText('DNF')).toBeInTheDocument()
  })
})
