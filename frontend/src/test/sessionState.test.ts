import { describe, it, expect } from 'vitest'
import {
  resolveSessionState,
  sessionState,
  sessionStateLabel,
} from '../lib/sessionState'
import type {
  ContextAvailability,
  ContextSession,
  DatasetInfo,
  Session,
  WeekendContext,
  WeekendSession,
} from '../types'

const NOW = new Date('2025-06-01T00:00:00Z')

function mk(
  overrides: Partial<Session>,
  source: WeekendSession['source'],
  datasets: Record<string, DatasetInfo> = {},
): WeekendSession {
  return {
    session: {
      session_key: 1,
      session_name: 'Race',
      session_type: 'Race',
      meeting_key: 1,
      date_start: '2025-05-25T13:00:00+00:00',
      date_end: '2025-05-25T15:00:00+00:00',
      gmt_offset: '00:00:00',
      ...overrides,
    },
    source,
    datasets,
  }
}

const FULL: Record<string, DatasetInfo> = Object.fromEntries(
  [
    'meeting',
    'session',
    'drivers',
    'results',
    'starting_grid',
    'stints',
    'pit_stops',
    'positions',
    'race_control',
    'weather',
    'laps',
  ].map((k) => [k, { status: 'available', source: 'local', count: 1 }]),
)

function availability(overrides: Partial<ContextAvailability> = {}): ContextAvailability {
  return {
    schedule: 'available',
    live_transport: 'unknown',
    live_session: 'inactive',
    archive: 'unavailable',
    local_analysis: 'complete',
    freshness: 'fresh',
    limitations: [],
    ...overrides,
  }
}

function contextSession(
  session: Session,
  avail: Partial<ContextAvailability> = {},
): ContextSession {
  return { session, availability: availability(avail) }
}

function context(overrides: Partial<WeekendContext> = {}): WeekendContext {
  return {
    temporal_state: 'post_weekend',
    championship_round: 1,
    total_championship_rounds: 1,
    ...overrides,
  }
}

describe('sessionState', () => {
  it('marks a future session as upcoming', () => {
    const s = mk({ date_start: '2099-05-25T13:00:00+00:00', date_end: '2099-05-25T15:00:00+00:00' }, 'none')
    expect(sessionState(s, NOW)).toBe('upcoming')
  })

  it('does not mark Live from schedule alone', () => {
    const start = new Date(NOW.getTime() - 60_000).toISOString()
    const end = new Date(NOW.getTime() + 60_000).toISOString()
    const s = mk({ date_start: start, date_end: end }, 'none')
    expect(sessionState(s, NOW)).toBe('preparing')
  })

  it('marks Live only when Weekend Context active identity matches', () => {
    const start = new Date(NOW.getTime() - 60_000).toISOString()
    const end = new Date(NOW.getTime() + 60_000).toISOString()
    const s = mk({ session_key: 42, date_start: start, date_end: end }, 'none')
    const ctx = context({
      temporal_state: 'session_live',
      active_session: contextSession(s.session, { live_session: 'active' }),
    })
    expect(resolveSessionState({ weekendSession: s, context: ctx, now: NOW })).toBe('live')
  })

  it('marks a finished session with full local data as ready', () => {
    const s = mk({}, 'local', FULL)
    expect(sessionState(s, NOW)).toBe('ready')
  })

  it('marks a finished session with no data as preparing', () => {
    const s = mk({}, 'none', {})
    expect(sessionState(s, NOW)).toBe('preparing')
  })

  it('marks a finished session with partial data as partial', () => {
    const s = mk({}, 'partial', { drivers: { status: 'available', source: 'local', count: 20 } })
    expect(sessionState(s, NOW)).toBe('partial')
  })

  it('marks unavailable from context availability', () => {
    const s = mk({ session_key: 7 }, 'none')
    const ctx = context({
      previous_completed_session: contextSession(s.session, {
        local_analysis: 'unavailable',
      }),
    })
    expect(resolveSessionState({ weekendSession: s, context: ctx, now: NOW })).toBe(
      'unavailable',
    )
  })

  it('marks a cancelled session as cancelled', () => {
    const s = mk({}, 'cancelled')
    expect(sessionState(s, NOW)).toBe('cancelled')
  })

  it('uses user language labels rather than coverage counts', () => {
    expect(sessionStateLabel('ready')).toBe('Ready')
    expect(sessionStateLabel('upcoming')).toBe('Upcoming')
    expect(sessionStateLabel('partial')).toBe('Partial')
    expect(sessionStateLabel('unavailable')).toBe('Unavailable')
  })
})
