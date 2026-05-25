import { describe, it, expect } from 'vitest'
import {
  currentMeeting,
  currentAndNextSession,
  focusMeetingKind,
  focusMeetingLabel,
  formatCountdown,
  nextUpcomingMeeting,
  pickFocusMeeting,
} from '../lib/schedule'
import type { Meeting, Session } from '../types'

const meeting = (overrides: Partial<Meeting> = {}): Meeting => ({
  meeting_key: 1,
  meeting_name: 'Monaco',
  meeting_official_name: 'Monaco GP',
  location: 'Monaco',
  country_name: 'Monaco',
  country_code: 'MON',
  country_flag: '',
  circuit_short_name: 'Monaco',
  date_start: '2025-05-23T00:00:00+00:00',
  date_end: '2025-05-25T23:59:59+00:00',
  year: 2025,
  ...overrides,
})

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

describe('schedule helpers', () => {
  it('picks current meeting when now is inside the weekend window', () => {
    const now = new Date('2025-05-24T12:00:00Z')
    const meetings = [meeting()]
    expect(currentMeeting(meetings, now)?.meeting_key).toBe(1)
    expect(pickFocusMeeting(meetings, now)?.meeting_key).toBe(1)
  })

  it('picks next upcoming meeting when all meetings are in the future', () => {
    const now = new Date('2025-01-01T00:00:00Z')
    const meetings = [meeting()]
    expect(nextUpcomingMeeting(meetings, now)?.meeting_key).toBe(1)
    expect(pickFocusMeeting(meetings, now)?.meeting_key).toBe(1)
    expect(focusMeetingKind(meetings[0], now)).toBe('next')
    expect(focusMeetingLabel('next')).toBe('Next Weekend')
  })

  it('falls back to most recent past meeting for historical local data', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const meetings = [meeting()]
    expect(pickFocusMeeting(meetings, now)?.meeting_key).toBe(1)
    expect(focusMeetingKind(meetings[0], now)).toBe('recent')
  })

  it('detects current and next sessions', () => {
    const sessions = [
      session({ session_key: 1, session_name: 'FP1', date_start: '2025-05-23T10:00:00+00:00', date_end: '2025-05-23T11:00:00+00:00' }),
      session({ session_key: 2, session_name: 'Race', date_start: '2025-05-25T13:00:00+00:00', date_end: '2025-05-25T15:00:00+00:00' }),
    ]

    const duringRace = new Date('2025-05-25T14:00:00+00:00')
    expect(currentAndNextSession(sessions, duringRace).current?.session_key).toBe(2)

    const beforeRace = new Date('2025-05-24T12:00:00+00:00')
    expect(currentAndNextSession(sessions, beforeRace).next?.session_key).toBe(2)
  })

  it('formats countdown strings', () => {
    const now = new Date('2025-05-25T12:00:00+00:00')
    const target = new Date('2025-05-25T13:00:00+00:00')
    expect(formatCountdown(target, now)).toBe('0d 01h 00m 00s')
  })
})
