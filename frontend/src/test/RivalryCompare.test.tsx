import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RivalryCompare } from '../components/RivalryCompare'
import type { ChampHubDriver, ChampionshipHub } from '../types'

function driver(over: Partial<ChampHubDriver>): ChampHubDriver {
  return {
    driver_number: 1,
    name_acronym: 'VER',
    full_name: 'Max Verstappen',
    team_name: 'Red Bull',
    team_colour: '3671c6',
    points: 100,
    position: 1,
    wins: 2,
    podiums: 3,
    poles: 1,
    form: [25, 18, 25],
    cumulative: [25, 43, 68],
    round_positions: [1, 2, 1],
    teammate_wins: 3,
    teammate_losses: 0,
    ...over,
  }
}

function makeHub(drivers: ChampHubDriver[]): ChampionshipHub {
  return {
    season: 2025,
    round: 3,
    total_rounds: 10,
    rounds_left: 7,
    last_race: 'Japan GP',
    round_labels: ['R1', 'R2', 'R3'],
    drivers,
    teams: [],
  }
}

const hub = makeHub([
  driver({}),
  driver({
    driver_number: 4,
    name_acronym: 'NOR',
    full_name: 'Lando Norris',
    team_name: 'McLaren',
    team_colour: 'ff8000',
    points: 90,
    position: 2,
    cumulative: [18, 43, 61],
    round_positions: [2, 1, 2],
  }),
  driver({
    driver_number: 16,
    name_acronym: 'LEC',
    full_name: 'Charles Leclerc',
    team_name: 'Ferrari',
    team_colour: 'e8002d',
    points: 50,
    position: 3,
    cumulative: [15, 28, 40],
    round_positions: [3, 0, 3],
  }),
])

describe('RivalryCompare', () => {
  it('defaults to the top two drivers and shows the H2H score', () => {
    render(<RivalryCompare hub={hub} />)

    expect(screen.getByTestId('champ-view-rivalry')).toBeInTheDocument()
    expect(screen.getByTestId('rivalry-pick-a')).toHaveValue('1')
    expect(screen.getByTestId('rivalry-pick-b')).toHaveValue('4')
    // VER wins R1 and R3, NOR wins R2.
    expect(screen.getByTestId('rivalry-h2h-num')).toHaveTextContent('2–1')
    expect(screen.getByText('3 rounds counted', { exact: false })).toBeInTheDocument()
    expect(screen.getByTestId('rivalry-points-race')).toBeInTheDocument()
    expect(screen.getByTestId('rivalry-gap')).toBeInTheDocument()
    // Last gap: 68 − 61 = +7 → VER ahead.
    expect(screen.getByText('VER leads by 7 pts', { exact: false })).toBeInTheDocument()
  })

  it('recomputes when a different driver is picked and skips missing rounds', () => {
    render(<RivalryCompare hub={hub} />)

    fireEvent.change(screen.getByTestId('rivalry-pick-b'), { target: { value: '16' } })

    // VER vs LEC: R2 skipped (LEC has no position), VER wins R1 and R3.
    expect(screen.getByTestId('rivalry-h2h-num')).toHaveTextContent('2–0')
    expect(screen.getByText('2 rounds counted · 1 skipped', { exact: false })).toBeInTheDocument()
  })

  it('shows an empty state with fewer than two drivers', () => {
    render(<RivalryCompare hub={makeHub([driver({})])} />)
    expect(screen.getByTestId('champ-view-rivalry')).toHaveTextContent('at least two drivers')
  })

  it('shows an empty message when no rounds are completed', () => {
    const empty = makeHub([
      driver({ cumulative: [], round_positions: [], form: [] }),
      driver({
        driver_number: 4,
        name_acronym: 'NOR',
        cumulative: [],
        round_positions: [],
        form: [],
      }),
    ])
    empty.round = 0
    empty.round_labels = []

    render(<RivalryCompare hub={empty} />)
    expect(screen.getByTestId('champ-view-rivalry')).toHaveTextContent('No completed rounds yet')
  })
})
