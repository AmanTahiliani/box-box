import { describe, expect, it } from 'vitest'
import {
  MAX_POINTS_PER_ROUND,
  POINTS_BY_POSITION,
  SCORING_POSITIONS,
  assignPosition,
  defaultRound,
  defaultScenario,
  emptyRound,
  normalizeScenario,
  pointsForPosition,
  projectStandings,
  simulatedPoints,
} from '../lib/simulator'
import type { Scenario } from '../lib/simulator'
import type { ChampHubDriver } from '../types'

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

const standings: ChampHubDriver[] = [
  driver({ driver_number: 1, name_acronym: 'VER', points: 200, position: 1 }),
  driver({ driver_number: 4, name_acronym: 'NOR', points: 190, position: 2 }),
  driver({ driver_number: 16, name_acronym: 'LEC', points: 120, position: 3 }),
  driver({ driver_number: 44, name_acronym: 'HAM', points: 40, position: 4 }),
]

describe('pointsForPosition', () => {
  it('matches the current F1 points table for P1–P10', () => {
    expect(POINTS_BY_POSITION).toEqual([25, 18, 15, 12, 10, 8, 6, 4, 2, 1])
    expect(pointsForPosition(1)).toBe(25)
    expect(pointsForPosition(2)).toBe(18)
    expect(pointsForPosition(10)).toBe(1)
  })

  it('awards zero outside the top ten and for invalid positions', () => {
    expect(pointsForPosition(0)).toBe(0)
    expect(pointsForPosition(11)).toBe(0)
    expect(pointsForPosition(-3)).toBe(0)
    expect(pointsForPosition(2.5)).toBe(0)
  })
})

describe('defaultRound / defaultScenario', () => {
  it('seeds the round with the current championship order', () => {
    const round = defaultRound(standings)
    expect(round.length).toBe(SCORING_POSITIONS)
    expect(round.slice(0, 4)).toEqual([1, 4, 16, 44])
    expect(round.slice(4)).toEqual([null, null, null, null, null, null])
  })

  it('sorts by points even when position fields disagree', () => {
    const shuffled = [
      driver({ driver_number: 4, points: 190, position: 2 }),
      driver({ driver_number: 1, points: 200, position: 1 }),
    ]
    expect(defaultRound(shuffled).slice(0, 2)).toEqual([1, 4])
  })

  it('builds one round per remaining round, and none for finished seasons', () => {
    expect(defaultScenario(standings, 3)).toHaveLength(3)
    expect(defaultScenario(standings, 0)).toHaveLength(0)
    expect(defaultScenario(standings, -2)).toHaveLength(0)
    expect(defaultScenario([], 2)[0]).toEqual(emptyRound())
  })
})

describe('simulatedPoints', () => {
  it('sums points across rounds per driver', () => {
    const scenario: Scenario = [defaultRound(standings), defaultRound(standings)]
    const totals = simulatedPoints(scenario)
    expect(totals.get(1)).toBe(50)
    expect(totals.get(4)).toBe(36)
    expect(totals.get(16)).toBe(30)
    expect(totals.get(44)).toBe(24)
  })

  it('ignores unassigned slots and empty scenarios', () => {
    expect(simulatedPoints([]).size).toBe(0)
    expect(simulatedPoints([emptyRound()]).size).toBe(0)
  })
})

describe('projectStandings', () => {
  it('returns an empty array for no drivers', () => {
    expect(projectStandings([], [emptyRound()], 3)).toEqual([])
  })

  it('keeps order and zero deltas under the default (status quo) scenario', () => {
    const rows = projectStandings(standings, defaultScenario(standings, 2), 2)
    expect(rows.map((r) => r.driver.driver_number)).toEqual([1, 4, 16, 44])
    expect(rows.every((r) => r.delta === 0)).toBe(true)
    expect(rows[0].projectedPoints).toBe(200 + 50)
  })

  it('computes projected points, positions, and deltas when the order flips', () => {
    // NOR wins both remaining rounds, VER scores nothing.
    const win: (number | null)[] = [4, ...Array(9).fill(null)]
    const rows = projectStandings(standings, [win, win], 2)

    const nor = rows.find((r) => r.driver.driver_number === 4)!
    const ver = rows.find((r) => r.driver.driver_number === 1)!
    expect(nor.projectedPoints).toBe(190 + 50)
    expect(nor.projectedPosition).toBe(1)
    expect(nor.delta).toBe(1) // moved up one place
    expect(ver.projectedPosition).toBe(2)
    expect(ver.delta).toBe(-1) // dropped one place
  })

  it('breaks projected-points ties by current position', () => {
    const pair = [
      driver({ driver_number: 1, name_acronym: 'VER', points: 100, position: 1 }),
      driver({ driver_number: 4, name_acronym: 'NOR', points: 90, position: 2 }),
    ]
    // NOR takes P5 (+10) → both project to 100. Better current position wins the tie.
    const round: (number | null)[] = [null, null, null, null, 4, null, null, null, null, null]
    const rows = projectStandings(pair, [round], 1)
    expect(rows[0].driver.driver_number).toBe(1)
    expect(rows[1].driver.driver_number).toBe(4)
    expect(rows[0].projectedPoints).toBe(100)
    expect(rows[1].projectedPoints).toBe(100)
    expect(rows.every((r) => r.delta === 0)).toBe(true)
  })
})

describe('title elimination math', () => {
  it('marks drivers alive when max remaining points can match the leader projection', () => {
    // Default scenario: leader VER projects to 200 + 2×25 = 250.
    // HAM max = 40 + 2×25 = 90 < 250 → OUT. NOR max = 190 + 50 = 240 < 250 → OUT.
    const rows = projectStandings(standings, defaultScenario(standings, 2), 2)
    const byNum = new Map(rows.map((r) => [r.driver.driver_number, r]))
    expect(byNum.get(1)!.titleAlive).toBe(true)
    expect(byNum.get(4)!.titleAlive).toBe(false)
    expect(byNum.get(44)!.titleAlive).toBe(false)
  })

  it('keeps close challengers alive when the leader scores nothing in the scenario', () => {
    // Leader scores 0 in both remaining rounds → leader projected stays 200.
    const scenario: Scenario = [emptyRound(), emptyRound()]
    const rows = projectStandings(standings, scenario, 2)
    const byNum = new Map(rows.map((r) => [r.driver.driver_number, r]))
    expect(byNum.get(4)!.titleAlive).toBe(true) // 190 + 50 ≥ 200
    expect(byNum.get(16)!.titleAlive).toBe(false) // 120 + 50 < 200
    expect(byNum.get(44)!.titleAlive).toBe(false) // 40 + 50 < 200
  })

  it('always keeps the current leader alive', () => {
    const scenario = defaultScenario(standings, 5)
    const rows = projectStandings(standings, scenario, 5)
    expect(rows.find((r) => r.driver.driver_number === 1)!.titleAlive).toBe(true)
  })

  it('handles zero rounds left: alive only means already matching the leader', () => {
    const rows = projectStandings(standings, [], 0)
    expect(rows[0].titleAlive).toBe(true)
    expect(rows.slice(1).every((r) => !r.titleAlive)).toBe(true)
  })

  it('uses 25 as the max points per round', () => {
    expect(MAX_POINTS_PER_ROUND).toBe(25)
  })
})

describe('normalizeScenario', () => {
  it('accepts a valid stored scenario', () => {
    const stored: Scenario = [
      [4, 1, null, null, null, null, null, null, null, null],
      defaultRound(standings),
    ]
    const result = normalizeScenario(JSON.parse(JSON.stringify(stored)), standings, 2)
    expect(result).toEqual(stored)
  })

  it('falls back to defaults for garbage input', () => {
    const def = defaultScenario(standings, 2)
    expect(normalizeScenario(undefined, standings, 2)).toEqual(def)
    expect(normalizeScenario('nope', standings, 2)).toEqual(def)
    expect(normalizeScenario({ a: 1 }, standings, 2)).toEqual(def)
    expect(normalizeScenario(42, standings, 2)).toEqual(def)
  })

  it('rejects rounds with unknown drivers, duplicates, or the wrong shape', () => {
    const def = defaultRound(standings)
    const bad: unknown = [
      [999, null, null, null, null, null, null, null, null, null], // unknown driver
      [1, 1, null, null, null, null, null, null, null, null], // duplicate
      [1, 4], // wrong length
    ]
    const result = normalizeScenario(bad, standings, 3)
    expect(result).toEqual([def, def, def])
  })

  it('trims or pads to the current rounds_left', () => {
    const one: Scenario = [[4, null, null, null, null, null, null, null, null, null]]
    expect(normalizeScenario(one, standings, 3)).toHaveLength(3)
    expect(normalizeScenario([...one, ...one, ...one], standings, 1)).toHaveLength(1)
  })
})

describe('assignPosition', () => {
  it('assigns a driver and removes it from its previous slot', () => {
    const round = defaultRound(standings) // [1, 4, 16, 44, ...]
    const next = assignPosition(round, 0, 4) // NOR to P1
    expect(next[0]).toBe(4)
    expect(next[1]).toBeNull() // NOR removed from P2
    expect(next[2]).toBe(16)
    expect(round[0]).toBe(1) // input not mutated
  })

  it('clears a slot when assigning null and ignores out-of-range positions', () => {
    const round = defaultRound(standings)
    expect(assignPosition(round, 0, null)[0]).toBeNull()
    expect(assignPosition(round, 99, 4)).toEqual(round)
    expect(assignPosition(round, -1, 4)).toEqual(round)
  })

  it('repairs short rounds to the full ten slots', () => {
    const next = assignPosition([1], 3, 4)
    expect(next).toHaveLength(SCORING_POSITIONS)
    expect(next[0]).toBe(1)
    expect(next[3]).toBe(4)
  })
})
