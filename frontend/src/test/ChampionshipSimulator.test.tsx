import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ChampionshipSimulator } from '../components/ChampionshipSimulator'
import type { ChampHubDriver, ChampionshipHub } from '../types'

function driver(over: Partial<ChampHubDriver>): ChampHubDriver {
  return {
    driver_number: 1,
    name_acronym: 'VER',
    full_name: 'Max Verstappen',
    team_name: 'Red Bull',
    team_colour: '3671c6',
    points: 0,
    position: 1,
    wins: 0,
    podiums: 0,
    poles: 0,
    form: [],
    cumulative: [],
    teammate_wins: 0,
    teammate_losses: 0,
    ...over,
  }
}

const drivers: ChampHubDriver[] = [
  driver({ driver_number: 1, name_acronym: 'VER', points: 200, position: 1 }),
  driver({
    driver_number: 4,
    name_acronym: 'NOR',
    full_name: 'Lando Norris',
    team_name: 'McLaren',
    team_colour: 'ff8000',
    points: 190,
    position: 2,
  }),
  driver({
    driver_number: 16,
    name_acronym: 'LEC',
    full_name: 'Charles Leclerc',
    team_name: 'Ferrari',
    team_colour: 'e8002d',
    points: 120,
    position: 3,
  }),
]

const hub: ChampionshipHub = {
  season: 2025,
  round: 9,
  total_rounds: 10,
  rounds_left: 1,
  last_race: 'Monaco GP',
  round_labels: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9'],
  drivers,
  teams: [],
}

describe('ChampionshipSimulator', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('seeds the round by championship order and projects the default scenario', () => {
    render(<ChampionshipSimulator hub={hub} />)

    expect(screen.getByTestId('champ-view-simulator')).toBeInTheDocument()
    // Only 1 remaining round; label falls back to "Round 10" (no label yet).
    expect(screen.getByTestId('sim-round-0')).toHaveTextContent('Round 10')
    // P1 select seeded with the current leader.
    expect(screen.getByTestId('sim-pos-1')).toHaveValue('1')
    expect(screen.getByTestId('sim-pos-2')).toHaveValue('4')

    // Default projection: VER 200+25=225 on top, delta arrows absent.
    const verRow = screen.getByTestId('sim-row-1')
    expect(within(verRow).getByText('225')).toBeInTheDocument()
    expect(within(verRow).getByText('P1')).toBeInTheDocument()
  })

  it('updates the projected table when a win is reassigned', () => {
    render(<ChampionshipSimulator hub={hub} />)

    // Give NOR the win; VER (previous P1) is bumped out of the slot.
    fireEvent.change(screen.getByTestId('sim-pos-1'), { target: { value: '4' } })

    // NOR: 190 + 25 = 215 → P1 with an up arrow; VER stays on 200 → P2 down.
    const norRow = screen.getByTestId('sim-row-4')
    expect(within(norRow).getByText('215')).toBeInTheDocument()
    expect(within(norRow).getByText('P1')).toBeInTheDocument()
    expect(within(norRow).getByText('▲1')).toBeInTheDocument()

    const verRow = screen.getByTestId('sim-row-1')
    // "200" appears in both Now and Proj columns (no simulated points).
    expect(within(verRow).getAllByText('200')).toHaveLength(2)
    expect(within(verRow).getByText('+0')).toBeInTheDocument()
    expect(within(verRow).getByText('P2')).toBeInTheDocument()
    expect(within(verRow).getByText('▼1')).toBeInTheDocument()

    // VER was removed from P1 and holds no slot now.
    expect(screen.getByTestId('sim-pos-1')).toHaveValue('4')
  })

  it('shows title alive/eliminated states', () => {
    render(<ChampionshipSimulator hub={hub} />)

    // Default: VER projects to 225. NOR max = 190+25=215 < 225 → OUT.
    expect(within(screen.getByTestId('sim-row-1')).getByText('ALIVE')).toBeInTheDocument()
    expect(within(screen.getByTestId('sim-row-4')).getByText('OUT')).toBeInTheDocument()

    // If VER scores nothing, NOR can still catch him: 190+25 ≥ 200 → ALIVE.
    fireEvent.change(screen.getByTestId('sim-pos-1'), { target: { value: '4' } })
    expect(within(screen.getByTestId('sim-row-4')).getByText('ALIVE')).toBeInTheDocument()
  })

  it('reset round and reset all restore the default order', () => {
    render(<ChampionshipSimulator hub={hub} />)

    fireEvent.change(screen.getByTestId('sim-pos-1'), { target: { value: '16' } })
    expect(screen.getByTestId('sim-pos-1')).toHaveValue('16')

    fireEvent.click(screen.getByTestId('sim-reset-round'))
    expect(screen.getByTestId('sim-pos-1')).toHaveValue('1')

    fireEvent.change(screen.getByTestId('sim-pos-1'), { target: { value: '16' } })
    fireEvent.click(screen.getByTestId('sim-reset-all'))
    expect(screen.getByTestId('sim-pos-1')).toHaveValue('1')
  })

  it('persists the scenario to localStorage keyed by season', () => {
    const { unmount } = render(<ChampionshipSimulator hub={hub} />)
    fireEvent.change(screen.getByTestId('sim-pos-1'), { target: { value: '4' } })
    unmount()

    const stored = window.localStorage.getItem('box-box.champ.sim.2025')
    expect(stored).not.toBeNull()

    render(<ChampionshipSimulator hub={hub} />)
    expect(screen.getByTestId('sim-pos-1')).toHaveValue('4')
  })

  it('survives corrupt localStorage', () => {
    window.localStorage.setItem('box-box.champ.sim.2025', '{not json')
    render(<ChampionshipSimulator hub={hub} />)
    expect(screen.getByTestId('sim-pos-1')).toHaveValue('1')
  })

  it('shows the season-complete empty state when no rounds remain', () => {
    render(<ChampionshipSimulator hub={{ ...hub, round: 10, rounds_left: 0 }} />)
    expect(screen.getByTestId('champ-view-simulator')).toHaveTextContent(
      'Season complete — nothing left to simulate.',
    )
  })

  it('uses round labels beyond the current round when available', () => {
    const labelled: ChampionshipHub = {
      ...hub,
      round: 8,
      rounds_left: 2,
      round_labels: [...hub.round_labels, 'ABU'],
    }
    render(<ChampionshipSimulator hub={labelled} />)
    expect(screen.getByTestId('sim-round-0')).toHaveTextContent('R9')
    expect(screen.getByTestId('sim-round-1')).toHaveTextContent('ABU')
  })
})
