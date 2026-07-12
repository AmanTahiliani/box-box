import type { ChampionshipHub, EnrichedGrid, EnrichedResult, Meeting, Session } from '../types'
import {
  currentAndNextSession,
  nextUpcomingMeeting,
  sessionStartTime,
  sortSessionsByStart,
} from './schedule'

export const RACE_WIN_POINTS = 25
export const SPRINT_WIN_POINTS = 8
export const SPRINT_WEEKEND_MAX_POINTS = RACE_WIN_POINTS + SPRINT_WIN_POINTS

export function pickPreviewMeeting(meetings: Meeting[], now: Date): Meeting | null {
  const active = meetings.filter((m) => !m.is_cancelled)
  return nextUpcomingMeeting(active, now)
}

export function findPriorYearMeetingByCircuit(
  priorYearMeetings: Meeting[],
  circuitKey: number | undefined,
): Meeting | null {
  if (!circuitKey) return null
  return priorYearMeetings.find((m) => m.circuit_key === circuitKey && !m.is_cancelled) ?? null
}

export function findRaceSession(sessions: Session[]): Session | null {
  const sorted = sortSessionsByStart(sessions)
  return (
    sorted.find((s) => {
      const type = s.session_type?.toLowerCase() ?? ''
      return type.includes('race') && !type.includes('sprint')
    }) ?? null
  )
}

export function isSprintWeekend(sessions: Session[]): boolean {
  return sessions.some((s) => {
    const label = `${s.session_type} ${s.session_name}`.toLowerCase()
    return /\bsprint\b/.test(label) && !label.includes('sprint qualifying') && !label.includes('sprint shootout')
  })
}

export interface PodiumPlace {
  position: number
  name_acronym: string
  full_name: string
  team_name: string
  team_colour: string
}

export interface PolePosition {
  name_acronym: string
  full_name: string
  team_name: string
  team_colour: string
}

export function extractPodium(results: EnrichedResult[]): PodiumPlace[] {
  return results
    .filter((r) => r.position >= 1 && r.position <= 3 && !r.dns && !r.dsq)
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      position: r.position,
      name_acronym: r.name_acronym,
      full_name: r.full_name,
      team_name: r.team_name,
      team_colour: r.team_colour,
    }))
}

export function extractPole(grid: EnrichedGrid[]): PolePosition | null {
  const pole = grid.find((g) => g.position === 1)
  if (!pole) return null
  return {
    name_acronym: pole.name_acronym,
    full_name: pole.full_name,
    team_name: pole.team_name,
    team_colour: pole.team_colour,
  }
}

export interface TitleFightDriver {
  name_acronym: string
  full_name: string
  team_colour: string
  points: number
  position: number
  gapToLeader: number
  gapAfterRaceWin: number
  gapAfterSprintWeekendMax: number
}

export function buildTitleFightContext(hub: ChampionshipHub): TitleFightDriver[] {
  if (hub.drivers.length === 0) return []
  const leader = hub.drivers[0]
  return hub.drivers.slice(0, 3).map((d) => ({
    name_acronym: d.name_acronym,
    full_name: d.full_name,
    team_colour: d.team_colour,
    points: d.points,
    position: d.position,
    gapToLeader: leader.points - d.points,
    gapAfterRaceWin: leader.points - (d.points + RACE_WIN_POINTS),
    gapAfterSprintWeekendMax: leader.points - (d.points + SPRINT_WEEKEND_MAX_POINTS),
  }))
}

export function countdownTargetSession(sessions: Session[], now: Date): Session | null {
  const sorted = sortSessionsByStart(sessions)
  const { next } = currentAndNextSession(sorted, now)
  if (next) return next
  for (const session of sorted) {
    const start = sessionStartTime(session)
    if (start && start > now) return session
  }
  return null
}

export function formatPointsGap(gap: number): string {
  if (gap === 0) return 'LEADER'
  const sign = gap > 0 ? '+' : ''
  return `${sign}${Number.isInteger(gap) ? gap : gap.toFixed(1)}`
}
