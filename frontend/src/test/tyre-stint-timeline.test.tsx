import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TyreStintTimeline, type StintTimelineRow } from '../components/charts/TyreStintTimeline'
import { StrategyView } from '../components/StrategyView'
import type { EnrichedResult, Stint, PitStop } from '../types'

const sampleRows: StintTimelineRow[] = [
  {
    label: 'VER',
    color: '#3671C6',
    stints: [
      { compound: 'MEDIUM', lapStart: 1, lapEnd: 30 },
      { compound: 'SOFT', lapStart: 31, lapEnd: 78 },
    ],
  },
  {
    label: 'HAM',
    color: '#E8002D',
    stints: [{ compound: 'SOFT', lapStart: 1, lapEnd: 18 }],
  },
]

describe('TyreStintTimeline', () => {
  it('renders one rect per stint', () => {
    const { container } = render(
      <TyreStintTimeline rows={sampleRows} totalLaps={78} />,
    )
    expect(container.querySelectorAll('.stint-timeline__bar')).toHaveLength(3)
  })

  it('maps compounds to color classes', () => {
    const { container } = render(
      <TyreStintTimeline rows={sampleRows} totalLaps={78} />,
    )
    const bars = container.querySelectorAll('.stint-timeline__bar')
    expect(bars[0]).toHaveClass('tyre-medium')
    expect(bars[1]).toHaveClass('tyre-soft')
    expect(bars[2]).toHaveClass('tyre-soft')
  })

  it('shows native title with compound, lap range, and stint length', () => {
    const { container } = render(
      <TyreStintTimeline rows={sampleRows} totalLaps={78} />,
    )
    const titles = [...container.querySelectorAll('title')].map((t) => t.textContent)
    expect(titles).toContain('Medium · L1–30 · 30 laps')
    expect(titles).toContain('Soft · L31–78 · 48 laps')
    expect(titles).toContain('Soft · L1–18 · 18 laps')
  })

  it('renders lap-axis ticks every 10 laps', () => {
    render(<TyreStintTimeline rows={sampleRows} totalLaps={78} />)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('70')).toBeInTheDocument()
  })

  it('shows legend only for used compounds', () => {
    render(<TyreStintTimeline rows={sampleRows} totalLaps={78} />)
    expect(screen.getByTestId('legend-soft')).toBeInTheDocument()
    expect(screen.getByTestId('legend-medium')).toBeInTheDocument()
    expect(screen.queryByTestId('legend-hard')).not.toBeInTheDocument()
    expect(screen.queryByTestId('legend-wet')).not.toBeInTheDocument()
    expect(screen.getByText('Soft')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('renders empty state when rows are empty', () => {
    render(<TyreStintTimeline rows={[]} totalLaps={50} />)
    expect(screen.getByTestId('stint-timeline-empty')).toBeInTheDocument()
    expect(screen.getByText(/No stint data/i)).toBeInTheDocument()
  })
})

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

const pitStops: PitStop[] = []

describe('StrategyView integration', () => {
  it('renders timeline when stints exist', () => {
    const { container } = render(
      <StrategyView results={results} stints={stints} pit_stops={pitStops} hasStints={true} />,
    )
    expect(container.querySelector('[data-testid="strategy-chart"]')).toBeInTheDocument()
    expect(screen.getByTestId('stint-timeline')).toBeInTheDocument()
    expect(screen.getByText('VER')).toBeInTheDocument()
    expect(screen.getByText('HAM')).toBeInTheDocument()
    expect(container.querySelectorAll('.stint-timeline__bar')).toHaveLength(2)
  })
})
