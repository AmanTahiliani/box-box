import type { DriverSummaryRound } from '../types'

/** One round mapped for the grid-vs-finish chart and results table. */
export interface RoundDelta {
  round: number // 1-based round index within the completed season
  label: string // short GP label, e.g. "Bahrain"
  grid: number | null
  finish: number | null
  /** grid − finish: positive = places gained on Sunday, null when unknowable. */
  delta: number | null
  points: number
  status: 'classified' | 'dnf' | 'dns' | 'dsq' | 'absent'
}

/** Strip the "Grand Prix" boilerplate so round labels fit chart axes. */
export function shortGpLabel(meetingName: string): string {
  const short = meetingName
    .replace(/\s*grand prix\s*/i, ' ')
    .replace(/\s+gp\s*$/i, ' ')
    .trim()
  return short || meetingName
}

function roundStatus(r: DriverSummaryRound): RoundDelta['status'] {
  if (r.dns) return 'dns'
  if (r.dsq) return 'dsq'
  if (r.dnf) return 'dnf'
  if (r.race_position <= 0 && r.grid_position <= 0) return 'absent'
  return 'classified'
}

/**
 * Map summary rounds to grid-vs-finish deltas. Positions of 0 mean "no data"
 * (driver absent, pit-lane start, …) and become null; a delta is only computed
 * when both ends are known and the driver actually started the race.
 */
export function gridFinishDeltas(rounds: DriverSummaryRound[]): RoundDelta[] {
  return rounds.map((r, i) => {
    const status = roundStatus(r)
    const grid = r.grid_position > 0 ? r.grid_position : null
    const finish = r.race_position > 0 ? r.race_position : null
    const delta =
      grid != null && finish != null && status !== 'dns' && status !== 'absent'
        ? grid - finish
        : null
    return {
      round: i + 1,
      label: shortGpLabel(r.meeting_name),
      grid,
      finish,
      delta,
      points: r.points,
      status,
    }
  })
}

/** 'P4' for known positions, '—' when unknown. */
export function formatPosition(pos: number | null): string {
  return pos != null && pos > 0 ? `P${pos}` : '—'
}

/** '+3' (gained), '−2' (lost), '=' (held), '—' (unknown). */
export function formatDelta(delta: number | null): string {
  if (delta == null) return '—'
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `−${Math.abs(delta)}`
  return '='
}
