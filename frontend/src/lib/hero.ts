import type { Session } from '../types'
import { sessionEndTime, sessionStartTime, type FocusMeetingKind } from './schedule'

export type HeroStateKind = 'live' | 'upcoming' | 'between'

export interface HeroStateInputs {
  now: Date
  liveActive: boolean
  currentSession: Session | null
  focusKind: FocusMeetingKind | null
}

export function classifySessionStatus(session: Session, now: Date): 'live' | 'done' | 'upcoming' {
  const start = sessionStartTime(session)
  const end = sessionEndTime(session)
  if (start && end && now >= start && now < end) return 'live'
  if (start && now >= start) return 'done'
  return 'upcoming'
}

export function heroState(inputs: HeroStateInputs): HeroStateKind {
  const { liveActive, currentSession, focusKind } = inputs

  if (liveActive || currentSession) return 'live'
  if (focusKind === 'current') return 'upcoming'
  return 'between'
}
