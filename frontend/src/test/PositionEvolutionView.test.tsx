import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PositionEvolutionView } from '../components/PositionEvolutionView'
import type { EnrichedResult, EnrichedGrid, PositionSample, Lap } from '../types'

const results: EnrichedResult[] = [
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
    duration: null,
    gap_to_leader: null,
    number_of_laps: 78,
    points: 25,
    session_key: 9472,
    meeting_key: 1229,
  },
  {
    driver_number: 44,
    position: 2,
    name_acronym: 'HAM',
    full_name: 'Lewis Hamilton',
    team_name: 'Ferrari',
    team_colour: 'E8002D',
    dnf: false,
    dns: false,
    dsq: false,
    duration: null,
    gap_to_leader: 5.1,
    number_of_laps: 78,
    points: 18,
    session_key: 9472,
    meeting_key: 1229,
  },
]

const grid: EnrichedGrid[] = [
  {
    driver_number: 1,
    position: 1,
    name_acronym: 'VER',
    full_name: 'Max Verstappen',
    team_name: 'Red Bull Racing',
    team_colour: '3671C6',
    session_key: 9472,
    meeting_key: 1229,
    lap_duration: 71.234,
  },
  {
    driver_number: 44,
    position: 2,
    name_acronym: 'HAM',
    full_name: 'Lewis Hamilton',
    team_name: 'Ferrari',
    team_colour: 'E8002D',
    session_key: 9472,
    meeting_key: 1229,
    lap_duration: 71.456,
  },
]

const positions: PositionSample[] = [
  {
    session_key: 9472,
    driver_number: 1,
    meeting_key: 1229,
    date: '2025-05-25T13:05:00+00:00',
    position: 1,
  },
  {
    session_key: 9472,
    driver_number: 1,
    meeting_key: 1229,
    date: '2025-05-25T13:10:00+00:00',
    position: 1,
  },
  {
    session_key: 9472,
    driver_number: 44,
    meeting_key: 1229,
    date: '2025-05-25T13:05:00+00:00',
    position: 2,
  },
]

const laps: Lap[] = [
  {
    session_key: 9472,
    driver_number: 1,
    meeting_key: 1229,
    lap_number: 1,
    date_start: '2025-05-25T13:00:00+00:00',
    lap_duration: 75.1,
    is_pit_out_lap: false,
  },
]

describe('PositionEvolutionView — positions available', () => {
  it('renders the position chart container', () => {
    const { container } = render(
      <PositionEvolutionView
        results={results}
        grid={grid}
        positions={positions}
        laps={laps}
        hasPositions={true}
      />
    )
    expect(container.querySelector('[data-testid="position-chart"]')).toBeInTheDocument()
  })

  it('renders an SVG chart', () => {
    const { container } = render(
      <PositionEvolutionView
        results={results}
        grid={grid}
        positions={positions}
        laps={laps}
        hasPositions={true}
      />
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.querySelectorAll('polyline').length).toBeGreaterThan(0)
  })

  it('does not show the missing-data notice', () => {
    render(
      <PositionEvolutionView
        results={results}
        grid={grid}
        positions={positions}
        laps={laps}
        hasPositions={true}
      />
    )
    expect(screen.queryByText(/Lap-by-lap positions not available/i)).not.toBeInTheDocument()
  })

  it('renders Grid → Finish table below chart', () => {
    render(
      <PositionEvolutionView
        results={results}
        grid={grid}
        positions={positions}
        laps={laps}
        hasPositions={true}
      />
    )
    expect(screen.getByText('Grid → Finish')).toBeInTheDocument()
  })
})

describe('PositionEvolutionView — positions missing', () => {
  it('shows the missing-data notice', () => {
    render(
      <PositionEvolutionView
        results={results}
        grid={grid}
        positions={[]}
        laps={[]}
        hasPositions={false}
      />
    )
    expect(screen.getByText(/Lap-by-lap positions not available/i)).toBeInTheDocument()
  })

  it('falls back to grid → finish table when both results and grid exist', () => {
    render(
      <PositionEvolutionView
        results={results}
        grid={grid}
        positions={[]}
        laps={[]}
        hasPositions={false}
      />
    )
    expect(screen.getByText('Grid → Finish')).toBeInTheDocument()
    expect(screen.getByText('VER')).toBeInTheDocument()
    expect(screen.getByText('HAM')).toBeInTheDocument()
  })

  it('does not render the position chart', () => {
    const { container } = render(
      <PositionEvolutionView
        results={results}
        grid={grid}
        positions={[]}
        laps={[]}
        hasPositions={false}
      />
    )
    expect(container.querySelector('[data-testid="position-chart"]')).not.toBeInTheDocument()
  })
})
