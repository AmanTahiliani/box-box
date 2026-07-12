import type { ContextSession, WeekendContext, WeekendSession } from '../types'
import { isSessionComplete } from './coverage'
import { sessionStartTime } from './schedule'

/**
 * User-facing lifecycle state for a weekend session.
 *
 * Live comes only from Weekend Context's FIA-backed active identity — never from
 * the scheduled start/end window alone. Preparing / partial / ready / unavailable
 * come from structured `availability.local_analysis` when a context ref exists,
 * otherwise from local dataset coverage after the scheduled start.
 */
export type SessionState =
  | 'upcoming'
  | 'live'
  | 'preparing'
  | 'partial'
  | 'ready'
  | 'unavailable'
  | 'cancelled'

export interface SessionStateInput {
  weekendSession?: WeekendSession
  context?: WeekendContext | null
  now: Date
}

function contextRefFor(
  context: WeekendContext | null | undefined,
  sessionKey: number | undefined,
): ContextSession | undefined {
  if (!context || !sessionKey) return undefined
  const refs = [
    context.active_session,
    context.default_analysis_session,
    context.previous_completed_session,
    context.next_session,
  ]
  return refs.find((ref) => ref?.session.session_key === sessionKey)
}

function fromAvailability(ref: ContextSession): SessionState | undefined {
  const { schedule, live_session, local_analysis } = ref.availability
  if (live_session === 'active') return 'live'
  if (schedule === 'unavailable' || local_analysis === 'unavailable') return 'unavailable'
  if (local_analysis === 'not_applicable') return 'upcoming'
  if (local_analysis === 'pending') return 'preparing'
  if (local_analysis === 'partial') return 'partial'
  if (local_analysis === 'complete') return 'ready'
  return undefined
}

/**
 * Resolve fan-facing session state. Prefer Weekend Context availability; never
 * assert Live from wall-clock schedule alone.
 */
export function resolveSessionState({
  weekendSession,
  context,
  now,
}: SessionStateInput): SessionState {
  if (weekendSession?.source === 'cancelled') return 'cancelled'

  const sessionKey = weekendSession?.session.session_key
  const active = context?.active_session
  if (
    active &&
    sessionKey &&
    active.session.session_key === sessionKey &&
    active.availability.live_session === 'active'
  ) {
    return 'live'
  }

  const ref = contextRefFor(context, sessionKey)
  if (ref) {
    const fromCtx = fromAvailability(ref)
    if (fromCtx) return fromCtx
  }

  // Settling temporal state with no analysis yet — even without a matching ref.
  if (
    context?.temporal_state === 'session_settling' &&
    weekendSession &&
    weekendSession.source === 'none'
  ) {
    return 'preparing'
  }

  if (!weekendSession) return 'unavailable'

  const start = sessionStartTime(weekendSession.session)
  if (start && start > now) return 'upcoming'

  if (isSessionComplete(weekendSession.datasets)) return 'ready'
  if (weekendSession.source === 'none') return 'preparing'
  if (weekendSession.source === 'partial') return 'partial'
  return 'ready'
}

/** @deprecated Prefer resolveSessionState with Weekend Context. */
export function sessionState(session: WeekendSession, now: Date): SessionState {
  return resolveSessionState({ weekendSession: session, now })
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
    case 'unavailable':
      return 'Unavailable'
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
      return 'Analysis is being prepared — local data is still settling.'
    case 'partial':
      return 'Partial analysis available — some datasets are still missing.'
    case 'ready':
      return 'Full analysis is ready.'
    case 'unavailable':
      return 'Analysis is not available for this session.'
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
    case 'unavailable':
      return 'rh-state-unavailable'
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

/** Settling / empty post-session — not yet analysable. */
export function isPreparing(state: SessionState): boolean {
  return state === 'preparing'
}

export function isUnavailable(state: SessionState): boolean {
  return state === 'unavailable' || state === 'cancelled'
}

/** Show fan analysis with a partial banner; keep available capabilities. */
export function isPartialAnalysis(state: SessionState): boolean {
  return state === 'partial'
}

/** Canonical default analysis session key from Weekend Context, if any. */
export function defaultAnalysisSessionKey(
  context: WeekendContext | null | undefined,
): number | undefined {
  const key = context?.default_analysis_session?.session.session_key
  return key && key > 0 ? key : undefined
}
