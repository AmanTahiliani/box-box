// Title math shared by the championship views. Pure functions only.

import type { ChampHubDriver, ChampionshipHub } from '../types'

/** Max points one driver can take from a Grand Prix / a Sprint (2025+ rules). */
export const MAX_RACE_POINTS = 25
export const MAX_SPRINT_POINTS = 8

/**
 * Most points any one driver can still score this season. Prefers the
 * server's sprint-aware `max_points_left`; falls back to race wins only for
 * older API responses that do not carry it.
 */
export function maxPointsLeft(hub: Pick<ChampionshipHub, 'rounds_left' | 'max_points_left' | 'sprints_left'>): number {
  if (typeof hub.max_points_left === 'number' && Number.isFinite(hub.max_points_left)) {
    return Math.max(0, hub.max_points_left)
  }
  const rounds = Math.max(0, hub.rounds_left || 0)
  const sprints = Math.max(0, hub.sprints_left || 0)
  return rounds * MAX_RACE_POINTS + sprints * MAX_SPRINT_POINTS
}

/**
 * The champion once the title is mathematically decided, else null.
 * Decided when the season is over, or when P2 cannot reach the leader even by
 * winning everything left. A gap exactly equal to the points left is still
 * treated as open (a tie would go to countback).
 */
export function decidedChampion(
  drivers: ReadonlyArray<ChampHubDriver>,
  maxLeft: number,
): ChampHubDriver | null {
  const [leader, second] = drivers
  if (!leader) return null
  if (maxLeft <= 0) return leader
  if (!second) return null
  return leader.points - second.points > maxLeft ? leader : null
}
