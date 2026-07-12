import type { Meeting, Session } from '../types'

const DEFAULT_SESSION_DURATION_MS = 3 * 60 * 60 * 1000

export function parseScheduleTime(value: string): Date | null {
  if (!value) return null
  const parsed = Date.parse(value)
  if (!Number.isNaN(parsed)) return new Date(parsed)
  const dateOnly = Date.parse(value.slice(0, 10))
  return Number.isNaN(dateOnly) ? null : new Date(dateOnly)
}

export function meetingStartTime(meeting: Meeting): Date | null {
  return parseScheduleTime(meeting.date_start)
}

export function meetingEndTime(meeting: Meeting): Date | null {
  const end = parseScheduleTime(meeting.date_end)
  if (end) return end
  const start = meetingStartTime(meeting)
  return start ? new Date(start.getTime() + 72 * 60 * 60 * 1000) : null
}

export function sessionStartTime(session: Session): Date | null {
  return parseScheduleTime(session.date_start)
}

export function sessionEndTime(session: Session): Date | null {
  const end = parseScheduleTime(session.date_end)
  if (end) return end
  const start = sessionStartTime(session)
  return start ? new Date(start.getTime() + DEFAULT_SESSION_DURATION_MS) : null
}

export function sortSessionsByStart(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    const left = sessionStartTime(a)?.getTime() ?? 0
    const right = sessionStartTime(b)?.getTime() ?? 0
    if (left !== right) return left - right
    return a.date_start.localeCompare(b.date_start)
  })
}

export function currentMeeting(meetings: Meeting[], now: Date): Meeting | null {
  let selected: Meeting | null = null
  let latest = 0

  for (const meeting of meetings) {
    const start = meetingStartTime(meeting)
    if (!start || start > now) continue
    const end = meetingEndTime(meeting)
    if (!end || now > new Date(end.getTime() + 24 * 60 * 60 * 1000)) continue
    const startMs = start.getTime()
    if (!selected || startMs > latest) {
      selected = meeting
      latest = startMs
    }
  }

  return selected
}

export function nextUpcomingMeeting(meetings: Meeting[], now: Date): Meeting | null {
  for (const meeting of meetings) {
    const start = meetingStartTime(meeting)
    if (start && start > now) return meeting
  }
  return null
}

export function mostRecentPastMeeting(meetings: Meeting[], now: Date): Meeting | null {
  let selected: Meeting | null = null
  let latest = 0

  for (const meeting of meetings) {
    const start = meetingStartTime(meeting)
    if (!start || start > now) continue
    const startMs = start.getTime()
    if (!selected || startMs > latest) {
      selected = meeting
      latest = startMs
    }
  }

  return selected
}

export function pickFocusMeeting(meetings: Meeting[], now: Date): Meeting | null {
  return (
    currentMeeting(meetings, now) ??
    nextUpcomingMeeting(meetings, now) ??
    mostRecentPastMeeting(meetings, now) ??
    meetings[0] ??
    null
  )
}

export function meetingHasStarted(meeting: Meeting, now: Date): boolean {
  const start = meetingStartTime(meeting)
  return start != null && now >= start
}

export function currentAndNextSession(
  sessions: Session[],
  now: Date,
): { current: Session | null; next: Session | null } {
  const sorted = sortSessionsByStart(sessions)

  for (const session of sorted) {
    const start = sessionStartTime(session)
    const end = sessionEndTime(session)
    if (!start || !end) continue

    if (now >= start && now < end) {
      return { current: session, next: null }
    }
    if (now < start) {
      return { current: null, next: session }
    }
  }

  return { current: null, next: null }
}

export function formatCountdown(target: Date, now: Date): string {
  const diffMs = Math.max(0, target.getTime() - now.getTime())
  const totalSeconds = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
}

export function formatSessionScheduleTime(value: string): string {
  const date = parseScheduleTime(value)
  if (!date) return '—'
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export type FocusMeetingKind = 'current' | 'next' | 'recent' | 'fallback'

export function focusMeetingKind(meeting: Meeting, now: Date): FocusMeetingKind {
  if (currentMeeting([meeting], now)) return 'current'
  if (nextUpcomingMeeting([meeting], now)) return 'next'
  if (mostRecentPastMeeting([meeting], now)) return 'recent'
  return 'fallback'
}

export function focusMeetingLabel(kind: FocusMeetingKind): string {
  switch (kind) {
    case 'current':
      return 'Current Weekend'
    case 'next':
      return 'Next Weekend'
    case 'recent':
      return 'Recent Local Weekend'
    default:
      return 'Weekend'
  }
}
