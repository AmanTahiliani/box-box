// Championship simulator: project the drivers' championship over the
// remaining rounds from per-round finishing assignments.
// Pure functions only — no React, no side effects — so everything is unit-testable.

import type { ChampHubDriver } from '../types'

/** Current F1 points system for P1–P10. No fastest-lap point (dropped in 2025). */
export const POINTS_BY_POSITION = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const

/** Number of points-scoring positions per round. */
export const SCORING_POSITIONS = POINTS_BY_POSITION.length

/** Maximum points a single driver can take from one round. */
export const MAX_POINTS_PER_ROUND = POINTS_BY_POSITION[0]

/**
 * One remaining round: driver numbers assigned to P1–P10 (index 0 = P1).
 * `null` means the position is unassigned (nobody scores those points).
 */
export type RoundAssignment = (number | null)[]

/** One assignment per remaining round, in chronological order. */
export type Scenario = RoundAssignment[]

/** Points for a 1-based finishing position; 0 outside the top ten. */
export function pointsForPosition(position: number): number {
  if (!Number.isInteger(position) || position < 1 || position > SCORING_POSITIONS) return 0
  return POINTS_BY_POSITION[position - 1]
}

/** An empty round: all ten scoring positions unassigned. */
export function emptyRound(): RoundAssignment {
  return Array.from({ length: SCORING_POSITIONS }, () => null)
}

/** Drivers sorted by current championship order (points desc, position asc). */
function championshipOrder(drivers: ReadonlyArray<ChampHubDriver>): ChampHubDriver[] {
  return [...drivers].sort((a, b) => b.points - a.points || a.position - b.position)
}

/**
 * Default assignment for one round: the top ten drivers in current
 * championship order finish P1–P10.
 */
export function defaultRound(drivers: ReadonlyArray<ChampHubDriver>): RoundAssignment {
  const ordered = championshipOrder(drivers)
  const round = emptyRound()
  for (let i = 0; i < SCORING_POSITIONS; i++) {
    round[i] = ordered[i]?.driver_number ?? null
  }
  return round
}

/** Default scenario: every remaining round finishes in current championship order. */
export function defaultScenario(drivers: ReadonlyArray<ChampHubDriver>, roundsLeft: number): Scenario {
  const rounds = Math.max(0, Math.floor(roundsLeft) || 0)
  return Array.from({ length: rounds }, () => defaultRound(drivers))
}

/**
 * Validate an untrusted (e.g. localStorage) scenario against the current hub.
 * Rounds with the wrong shape, unknown driver numbers, or duplicate drivers
 * fall back to the default round; the scenario is trimmed/padded to
 * `roundsLeft`. Never throws.
 */
export function normalizeScenario(
  raw: unknown,
  drivers: ReadonlyArray<ChampHubDriver>,
  roundsLeft: number,
): Scenario {
  const fallback = defaultScenario(drivers, roundsLeft)
  if (!Array.isArray(raw)) return fallback

  const known = new Set(drivers.map((d) => d.driver_number))
  return fallback.map((defRound, i) => {
    const candidate = raw[i]
    if (!Array.isArray(candidate) || candidate.length !== SCORING_POSITIONS) return defRound
    const seen = new Set<number>()
    const round = emptyRound()
    for (let p = 0; p < SCORING_POSITIONS; p++) {
      const v = candidate[p]
      if (v === null) continue
      if (typeof v !== 'number' || !known.has(v) || seen.has(v)) return defRound
      seen.add(v)
      round[p] = v
    }
    return round
  })
}

/** Total simulated (extra) points per driver number across the scenario. */
export function simulatedPoints(scenario: Scenario): Map<number, number> {
  const totals = new Map<number, number>()
  for (const round of scenario) {
    if (!Array.isArray(round)) continue
    for (let p = 0; p < Math.min(round.length, SCORING_POSITIONS); p++) {
      const driverNumber = round[p]
      if (driverNumber == null) continue
      totals.set(driverNumber, (totals.get(driverNumber) ?? 0) + POINTS_BY_POSITION[p])
    }
  }
  return totals
}

export interface ProjectedDriver {
  driver: ChampHubDriver
  currentPoints: number
  simPoints: number
  projectedPoints: number
  currentPosition: number
  projectedPosition: number
  /** Positive = moved up the standings, negative = dropped. */
  delta: number
  /** Mathematically alive for the title under the max-points-remaining bound. */
  titleAlive: boolean
}

/**
 * Project final standings from current standings plus a scenario.
 * Ties on projected points keep the driver with the better current position ahead.
 *
 * Title math: a driver is mathematically alive if
 *   current points + 25 × rounds left ≥ current leader's points under the scenario.
 * The current leader is always alive by this bound.
 */
export function projectStandings(
  drivers: ReadonlyArray<ChampHubDriver>,
  scenario: Scenario,
  roundsLeft: number,
): ProjectedDriver[] {
  if (drivers.length === 0) return []

  const extras = simulatedPoints(scenario)
  const ordered = championshipOrder(drivers)
  const leader = ordered[0]
  const leaderProjected = leader.points + (extras.get(leader.driver_number) ?? 0)
  const maxRemaining = MAX_POINTS_PER_ROUND * Math.max(0, roundsLeft)

  const rows = ordered.map((driver, i) => {
    const simPoints = extras.get(driver.driver_number) ?? 0
    return {
      driver,
      currentPoints: driver.points,
      simPoints,
      projectedPoints: driver.points + simPoints,
      currentPosition: i + 1,
      projectedPosition: 0,
      delta: 0,
      titleAlive: driver.points + maxRemaining >= leaderProjected,
    }
  })

  rows.sort(
    (a, b) => b.projectedPoints - a.projectedPoints || a.currentPosition - b.currentPosition,
  )
  rows.forEach((row, i) => {
    row.projectedPosition = i + 1
    row.delta = row.currentPosition - row.projectedPosition
  })
  return rows
}

/**
 * Assign a driver to a position within one round, returning a new round.
 * The driver is removed from any other position it held; assigning `null`
 * clears the slot.
 */
export function assignPosition(
  round: RoundAssignment,
  positionIndex: number,
  driverNumber: number | null,
): RoundAssignment {
  const next = round.slice(0, SCORING_POSITIONS)
  while (next.length < SCORING_POSITIONS) next.push(null)
  if (positionIndex < 0 || positionIndex >= SCORING_POSITIONS) return next
  if (driverNumber != null) {
    for (let p = 0; p < next.length; p++) {
      if (next[p] === driverNumber) next[p] = null
    }
  }
  next[positionIndex] = driverNumber
  return next
}
