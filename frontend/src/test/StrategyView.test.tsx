import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StrategyView } from '../components/StrategyView'
import type { EnrichedResult, Stint, PitStop } from '../types'

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

const stints: Stint[] = [
  {
    session_key: 9472,
    driver_number: 1,
    meeting_key: 1229,
    stint_number: 1,
    compound: 'MEDIUM',
    lap_start: 1,
    lap_end: 30,
    tyre_age_at_start: 0,
  },
  {
    session_key: 9472,
    driver_number: 44,
    meeting_key: 1229,
    stint_number: 1,
    compound: 'SOFT',
    lap_start: 1,
    lap_end: 18,
    tyre_age_at_start: 0,
  },
]

const pitStops: PitStop[] = [
  {
    session_key: 9472,
    driver_number: 44,
    meeting_key: 1229,
    lap_number: 19,
    date: '2025-05-25T14:00:00+00:00',
    pit_duration: 2.4,
    lane_duration: 0,
    stop_duration: 2.4,
  },
]

describe('StrategyView — stints available', () => {
  it('renders the strategy chart container', () => {
    const { container } = render(
      <StrategyView results={results} stints={stints} pit_stops={pitStops} hasStints={true} />
    )
    expect(container.querySelector('[data-testid="strategy-chart"]')).toBeInTheDocument()
  })

  it('renders driver acronyms as SVG text', () => {
    render(
      <StrategyView results={results} stints={stints} pit_stops={pitStops} hasStints={true} />
    )
    expect(screen.getByText('VER')).toBeInTheDocument()
    expect(screen.getByText('HAM')).toBeInTheDocument()
  })

  it('renders an SVG stint chart', () => {
    const { container } = render(
      <StrategyView results={results} stints={stints} pit_stops={pitStops} hasStints={true} />
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(0)
  })

  it('does not show the stints-unavailable notice', () => {
    render(
      <StrategyView results={results} stints={stints} pit_stops={pitStops} hasStints={true} />
    )
    expect(screen.queryByText(/Stints not available/i)).not.toBeInTheDocument()
  })

  it('maps pit_stops into timeline pit markers for the matching driver', () => {
    const { container } = render(
      <StrategyView results={results} stints={stints} pit_stops={pitStops} hasStints={true} />
    )
    const markers = container.querySelectorAll('[data-testid="pit-marker"]')
    expect(markers).toHaveLength(1)
    expect(markers[0]).toHaveAttribute('data-lap', '19')
    const titles = [...container.querySelectorAll('title')].map((t) => t.textContent)
    expect(titles).toContain('HAM pit stop · L19')
  })
})

describe('StrategyView — stints missing', () => {
  it('shows the missing-data notice', () => {
    render(
      <StrategyView results={results} stints={[]} pit_stops={[]} hasStints={false} />
    )
    expect(screen.getByText(/Stints not available/i)).toBeInTheDocument()
  })

  it('falls back to laps-completed table', () => {
    render(
      <StrategyView results={results} stints={[]} pit_stops={[]} hasStints={false} />
    )
    expect(screen.getByText('VER')).toBeInTheDocument()
    expect(screen.getByText('HAM')).toBeInTheDocument()
    expect(screen.getAllByText('78').length).toBe(2)
  })

  it('does not render the strategy chart', () => {
    const { container } = render(
      <StrategyView results={results} stints={[]} pit_stops={[]} hasStints={false} />
    )
    expect(container.querySelector('[data-testid="strategy-chart"]')).not.toBeInTheDocument()
  })
})
