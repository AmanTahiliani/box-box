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

/** Grand Prix finishing-position counts (position -> count) from round_positions. */
function finishCounts(positions: ReadonlyArray<number> | undefined): Map<number, number> {
  const counts = new Map<number, number>()
  for (const p of positions ?? []) {
    if (p > 0) counts.set(p, (counts.get(p) ?? 0) + 1)
  }
  return counts
}

/**
 * True only when `leader` is guaranteed to beat `rival` on countback if the
 * rival wins every remaining Grand Prix and the leader scores nothing (the
 * only way the two can finish level when the gap equals the points left).
 * The leader's remaining finishes are unknown but outside the points, so a
 * countback decided in the leader's favour cannot be overturned by them.
 */
function leaderWinsWorstCaseCountback(leader: ChampHubDriver, rival: ChampHubDriver, roundsLeft: number): boolean {
  const lead = finishCounts(leader.round_positions)
  const riv = finishCounts(rival.round_positions)
  riv.set(1, (riv.get(1) ?? 0) + Math.max(0, roundsLeft))
  const maxPos = Math.max(0, ...lead.keys(), ...riv.keys())
  for (let p = 1; p <= maxPos; p++) {
    const diff = (lead.get(p) ?? 0) - (riv.get(p) ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

/**
 * The champion once the title is mathematically decided, else null.
 * `drivers` must be in championship order (ties already resolved by the
 * server's countback). Decided when the season is over, or when no rival can
 * catch the leader: every rival is further behind than the points left, or
 * exactly that far behind but certain to lose the countback.
 */
export function decidedChampion(
  drivers: ReadonlyArray<ChampHubDriver>,
  maxLeft: number,
  roundsLeft = 0,
): ChampHubDriver | null {
  const [leader, ...rivals] = drivers
  if (!leader) return null
  if (maxLeft <= 0) return leader
  if (rivals.length === 0) return null
  for (const rival of rivals) {
    const gap = leader.points - rival.points
    if (gap > maxLeft) continue
    if (gap === maxLeft && leaderWinsWorstCaseCountback(leader, rival, roundsLeft)) continue
    return null
  }
  return leader
}
