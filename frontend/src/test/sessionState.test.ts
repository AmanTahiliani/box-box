import { describe, it, expect } from 'vitest'
import { sessionState, sessionStateLabel } from '../lib/sessionState'
import type { DatasetInfo, Session, WeekendSession } from '../types'

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

describe('sessionState', () => {
  it('marks a future session as upcoming', () => {
    const s = mk({ date_start: '2099-05-25T13:00:00+00:00', date_end: '2099-05-25T15:00:00+00:00' }, 'none')
    expect(sessionState(s, NOW)).toBe('upcoming')
  })

  it('marks a running session as live', () => {
    const start = new Date(NOW.getTime() - 60_000).toISOString()
    const end = new Date(NOW.getTime() + 60_000).toISOString()
    const s = mk({ date_start: start, date_end: end }, 'partial')
    expect(sessionState(s, NOW)).toBe('live')
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

  it('marks a cancelled session as cancelled', () => {
    const s = mk({}, 'cancelled')
    expect(sessionState(s, NOW)).toBe('cancelled')
  })

  it('uses user language labels rather than coverage counts', () => {
    expect(sessionStateLabel('ready')).toBe('Ready')
    expect(sessionStateLabel('upcoming')).toBe('Upcoming')
    expect(sessionStateLabel('partial')).toBe('Partial')
  })
})
