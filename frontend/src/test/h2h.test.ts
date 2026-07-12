import { describe, expect, it } from 'vitest'
import { teammatePairs } from '../lib/h2h'
import type { ChampHubDriver } from '../types'

function driver(over: Partial<ChampHubDriver>): ChampHubDriver {
  return {
    driver_number: 1,
    name_acronym: 'VER',
    full_name: 'Max Verstappen',
    team_name: 'Red Bull',
    team_colour: '3671c6',
    points: 200,
    position: 1,
    wins: 5,
    podiums: 8,
    poles: 4,
    form: [],
    cumulative: [],
    teammate_wins: 9,
    teammate_losses: 1,
    round_positions: [],
    ...over,
  }
}

describe('teammatePairs', () => {
  it('returns empty for no drivers', () => {
    expect(teammatePairs([])).toEqual([])
  })

  it('skips teams with a single driver', () => {
    const drivers = [
      driver({ driver_number: 1, team_name: 'Red Bull' }),
      driver({ driver_number: 44, name_acronym: 'HAM', team_name: 'Mercedes', points: 50 }),
    ]
    expect(teammatePairs(drivers)).toHaveLength(0)
  })

  it('pairs two-driver teams', () => {
    const drivers = [
      driver({ driver_number: 1, name_acronym: 'VER', points: 200, teammate_wins: 9, teammate_losses: 1 }),
      driver({
        driver_number: 11,
        name_acronym: 'PER',
        full_name: 'Sergio Perez',
        points: 60,
        teammate_wins: 1,
        teammate_losses: 9,
      }),
    ]
    const pairs = teammatePairs(drivers)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].teamName).toBe('Red Bull')
    expect(pairs[0].driverA.name_acronym).toBe('VER')
    expect(pairs[0].driverB.name_acronym).toBe('PER')
    expect(pairs[0].extraCount).toBe(0)
    expect(pairs[0].closeness).toBe(8)
  })

  it('uses top two by points for teams with 3+ drivers', () => {
    const drivers = [
      driver({ driver_number: 1, name_acronym: 'VER', team_name: 'Red Bull', points: 200 }),
      driver({
        driver_number: 11,
        name_acronym: 'PER',
        team_name: 'Red Bull',
        points: 60,
        teammate_wins: 1,
        teammate_losses: 9,
      }),
      driver({
        driver_number: 99,
        name_acronym: 'LAW',
        full_name: 'Liam Lawson',
        team_name: 'Red Bull',
        points: 10,
        teammate_wins: 0,
        teammate_losses: 0,
      }),
    ]
    const pairs = teammatePairs(drivers)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].driverA.name_acronym).toBe('VER')
    expect(pairs[0].driverB.name_acronym).toBe('PER')
    expect(pairs[0].extraCount).toBe(1)
  })

  it('sorts by closest battle first', () => {
    const drivers = [
      driver({
        driver_number: 1,
        name_acronym: 'VER',
        team_name: 'Red Bull',
        points: 200,
        teammate_wins: 10,
        teammate_losses: 0,
      }),
      driver({
        driver_number: 11,
        name_acronym: 'PER',
        team_name: 'Red Bull',
        points: 60,
        teammate_wins: 0,
        teammate_losses: 10,
      }),
      driver({
        driver_number: 4,
        name_acronym: 'NOR',
        team_name: 'McLaren',
        team_colour: 'ff8000',
        points: 160,
        teammate_wins: 6,
        teammate_losses: 5,
      }),
      driver({
        driver_number: 81,
        name_acronym: 'PIA',
        full_name: 'Oscar Piastri',
        team_name: 'McLaren',
        team_colour: 'ff8000',
        points: 140,
        teammate_wins: 5,
        teammate_losses: 6,
      }),
    ]
    const pairs = teammatePairs(drivers)
    expect(pairs).toHaveLength(2)
    expect(pairs[0].teamName).toBe('McLaren')
    expect(pairs[0].closeness).toBe(1)
    expect(pairs[1].teamName).toBe('Red Bull')
    expect(pairs[1].closeness).toBe(10)
  })
})
