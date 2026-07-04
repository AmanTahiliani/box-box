import { describe, it, expect } from 'vitest'
import { heroState, classifySessionStatus } from '../lib/hero'
import { currentAndNextSession } from '../lib/schedule'
import type { Session } from '../types'

const session = (overrides: Partial<Session> = {}): Session => ({
  session_key: 9472,
  session_name: 'Race',
  session_type: 'Race',
  meeting_key: 1,
  date_start: '2025-05-25T13:00:00+00:00',
  date_end: '2025-05-25T15:00:00+00:00',
  gmt_offset: '02:00:00',
  ...overrides,
})

describe('heroState', () => {
  it('returns live when the live snapshot is active', () => {
    const now = new Date('2025-05-24T12:00:00Z')
    expect(
      heroState({
        now,
        liveActive: true,
        currentSession: null,
        focusKind: 'current',
      }),
    ).toBe('live')
  })

  it('returns live when a session is in progress', () => {
    const now = new Date('2025-05-25T14:00:00Z')
    const sessions = [session()]
    const { current } = currentAndNextSession(sessions, now)
    expect(
      heroState({
        now,
        liveActive: false,
        currentSession: current,
        focusKind: 'current',
      }),
    ).toBe('live')
  })

  it('returns upcoming during a focus weekend gap before the next session', () => {
    const now = new Date('2025-05-24T12:00:00Z')
    const sessions = [
      session({
        session_key: 1,
        session_name: 'FP1',
        date_start: '2025-05-23T10:00:00+00:00',
        date_end: '2025-05-23T11:00:00+00:00',
      }),
      session({
        session_key: 2,
        session_name: 'Race',
        date_start: '2025-05-25T13:00:00+00:00',
        date_end: '2025-05-25T15:00:00+00:00',
      }),
    ]
    const { current, next } = currentAndNextSession(sessions, now)
    expect(current).toBeNull()
    expect(next?.session_key).toBe(2)
    expect(
      heroState({
        now,
        liveActive: false,
        currentSession: current,
        focusKind: 'current',
      }),
    ).toBe('upcoming')
  })

  it('returns upcoming when the weekend just ended but is still the focus weekend', () => {
    const now = new Date('2025-05-25T16:00:00Z')
    const sessions = [session()]
    const { current } = currentAndNextSession(sessions, now)
    expect(current).toBeNull()
    expect(
      heroState({
        now,
        liveActive: false,
        currentSession: current,
        focusKind: 'current',
      }),
    ).toBe('upcoming')
  })

  it('returns between before the next grand prix weekend', () => {
    const now = new Date('2025-06-01T12:00:00Z')
    expect(
      heroState({
        now,
        liveActive: false,
        currentSession: null,
        focusKind: 'next',
      }),
    ).toBe('between')
  })

  it('returns between after the season when only a recent meeting remains', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    expect(
      heroState({
        now,
        liveActive: false,
        currentSession: null,
        focusKind: 'recent',
      }),
    ).toBe('between')
  })
})

describe('classifySessionStatus', () => {
  it('marks a session as done immediately after it ends', () => {
    const now = new Date('2025-05-25T15:00:00Z')
    expect(classifySessionStatus(session(), now)).toBe('done')
  })

  it('marks a session as live during its window', () => {
    const now = new Date('2025-05-25T14:00:00Z')
    expect(classifySessionStatus(session(), now)).toBe('live')
  })
})
