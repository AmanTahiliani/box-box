import type { WeekendSession } from '../types'
import { isSessionComplete } from './coverage'
import { sessionEndTime, sessionStartTime } from './schedule'

/**
 * User-facing lifecycle state for a weekend session. Combines the schedule
 * (has it started / finished) with local dataset coverage so the UI can speak
 * in fan language instead of raw `x/11` coverage counts.
 *
 * - `upcoming`   — starts in the future; render a pre-session view.
 * - `live`       — currently running (started, not yet finished).
 * - `preparing`  — finished (or unknown timing) but no local analysis yet.
 * - `partial`    — finished with some, but not all, local datasets.
 * - `ready`      — finished with full local coverage; analysis is trustworthy.
 * - `cancelled`  — session was cancelled.
 */
export type SessionState =
  | 'upcoming'
  | 'live'
  | 'preparing'
  | 'partial'
  | 'ready'
  | 'cancelled'

export function sessionState(session: WeekendSession, now: Date): SessionState {
  if (session.source === 'cancelled') return 'cancelled'

  const start = sessionStartTime(session.session)
  const end = sessionEndTime(session.session)

  if (start && start > now) return 'upcoming'
  if (start && end && now >= start && now < end) return 'live'

  // Session has started/finished (or timing unknown) — describe it by coverage.
  if (isSessionComplete(session.datasets)) return 'ready'
  if (session.source === 'none') return 'preparing'
  return 'partial'
}

/** Short label suitable for chips and the session switcher. */
export function sessionStateLabel(state: SessionState): string {
  switch (state) {
    case 'upcoming':
      return 'Upcoming'
    case 'live':
      return 'Live'
    case 'preparing':
      return 'Preparing'
    case 'partial':
      return 'Partial'
    case 'ready':
      return 'Ready'
    case 'cancelled':
      return 'Cancelled'
  }
}

/** Longer, sentence-style description for headers and empty states. */
export function sessionStateDescription(state: SessionState): string {
  switch (state) {
    case 'upcoming':
      return 'Session has not started yet.'
    case 'live':
      return 'Session is running now.'
    case 'preparing':
      return 'Analysis is being prepared — no local data ingested yet.'
    case 'partial':
      return 'Partial analysis available — some datasets are still missing.'
    case 'ready':
      return 'Full analysis is ready.'
    case 'cancelled':
      return 'This session was cancelled.'
  }
}

/**
 * Class suffix used for the coverage dot, so the rail can colour a session by
 * its lifecycle state rather than only by data source.
 */
export function sessionStateDotClass(state: SessionState): string {
  switch (state) {
    case 'ready':
      return 'rh-state-ready'
    case 'partial':
      return 'rh-state-partial'
    case 'live':
      return 'rh-state-live'
    case 'upcoming':
      return 'rh-state-upcoming'
    case 'cancelled':
      return 'rh-state-cancelled'
    default:
      return 'rh-state-preparing'
  }
}

/** Whether a session should render the pre-session (expected availability) view. */
export function isPreSession(state: SessionState): boolean {
  return state === 'upcoming'
}
