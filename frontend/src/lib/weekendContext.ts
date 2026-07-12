import type {
  ChampionshipHub,
  EnrichedResult,
  Meeting,
  NewsItem,
  Session,
  Weekend,
  WeekendChampionshipImpact,
  WeekendChampionshipMover,
  WeekendCompletedEvent,
  WeekendContext,
  WeekendPodiumEntry,
  WeekendSeasonRound,
  WeekendState,
  WeekendTimelineSession,
  WeekendUpcomingEvent,
} from '../types'
import {
  currentMeeting,
  meetingEndTime,
  meetingStartTime,
  mostRecentPastMeeting,
  nextUpcomingMeeting,
  sessionEndTime,
  sessionStartTime,
  sortSessionsByStart,
} from './schedule'

// A session that finished within this window is still "settling" — results and
// analysis are landing, so the Weekend surfaces a settling handoff rather than a
// fully-formed recap (see sibling live-settling story #74).
const SETTLING_MS = 45 * 60 * 1000
// A race that finished within this window keeps the Weekend in its immediate
// post-weekend aftermath before it relaxes into the general between-races cadence.
const POST_WEEKEND_MS = 48 * 60 * 60 * 1000

export interface WeekendContextInputs {
  season: number | null
  meetings: Meeting[]
  weekendsByKey: Map<number, Weekend>
  championship?: ChampionshipHub
  liveActive: boolean
  news: NewsItem[]
  /** Sessions for the focus meeting when no local weekend is ingested. */
  focusSessions?: Session[]
  now: Date
}

function isRaceSession(session: Session): boolean {
  const type = (session.session_type || '').toLowerCase()
  const name = (session.session_name || '').toLowerCase()
  return type.includes('race') || name === 'race' || name === 'sprint'
}

/** Pick the session that best represents this weekend's primary analysis. */
function pickAnalysisSession(weekend: Weekend | undefined, fallback: Session[]): Session | undefined {
  if (weekend && weekend.sessions.length > 0) {
    const local = weekend.sessions.filter((s) => s.source === 'local')
    const partial = weekend.sessions.filter((s) => s.source === 'partial')
    const pool = local.length > 0 ? local : partial.length > 0 ? partial : weekend.sessions
    const race = pool.find((s) => isRaceSession(s.session))
    if (race) return race.session
    const quali = pool.find((s) => s.session.session_type?.toLowerCase().includes('qualifying'))
    if (quali) return quali.session
    const byDefault = weekend.sessions.find((s) => s.session.session_key === weekend.default_session_key)
    return (byDefault ?? pool[0])?.session
  }
  const race = fallback.find(isRaceSession)
  return race ?? fallback[0]
}

function weekendSessions(weekend: Weekend | undefined, focusSessions: Session[] | undefined): Session[] {
  if (weekend && weekend.sessions.length > 0) return weekend.sessions.map((s) => s.session)
  return focusSessions ?? []
}

function timeline(sessions: Session[], now: Date): WeekendTimelineSession[] {
  const sorted = sortSessionsByStart(sessions)
  const nextKey = sorted.find((s) => {
    const start = sessionStartTime(s)
    return start != null && start > now
  })?.session_key
  return sorted.map((session) => {
    const start = sessionStartTime(session)
    const end = sessionEndTime(session)
    let status: WeekendTimelineSession['status'] = 'upcoming'
    if (start && end && now >= start && now < end) status = 'live'
    else if (start && now >= start) status = 'done'
    else if (session.session_key === nextKey) status = 'next'
    return {
      session_key: session.session_key,
      session_name: session.session_name,
      session_type: session.session_type,
      date_start: session.date_start,
      date_end: session.date_end,
      status,
    }
  })
}

/** Most recently completed session in a weekend, by end time. */
function lastCompletedSession(sessions: Session[], now: Date): Session | undefined {
  let selected: Session | undefined
  let latest = -Infinity
  for (const session of sessions) {
    const end = sessionEndTime(session)
    if (!end || end > now) continue
    if (end.getTime() > latest) {
      latest = end.getTime()
      selected = session
    }
  }
  return selected
}

function meetingRound(meetings: Meeting[], meeting: Meeting): number {
  const active = meetings.filter((m) => !m.is_cancelled)
  const idx = active.findIndex((m) => m.meeting_key === meeting.meeting_key)
  return idx >= 0 ? idx + 1 : 0
}

export function podiumFromResults(results: EnrichedResult[]): WeekendPodiumEntry[] {
  return [...results]
    .filter((r) => r.position >= 1)
    .sort((a, b) => a.position - b.position)
    .slice(0, 3)
    .map((r) => ({
      position: r.position,
      driver_number: r.driver_number,
      name_acronym: r.name_acronym,
      team_name: r.team_name,
      team_colour: r.team_colour,
      gap: formatResultGap(r),
    }))
}

function formatResultGap(r: EnrichedResult): string {
  if (r.dnf) return 'DNF'
  if (r.dns) return 'DNS'
  if (r.dsq) return 'DSQ'
  if (r.position === 1) {
    if (typeof r.duration === 'number' && r.duration > 0) return formatDuration(r.duration)
    return 'Winner'
  }
  const gap = Array.isArray(r.gap_to_leader) ? r.gap_to_leader[r.gap_to_leader.length - 1] : r.gap_to_leader
  if (typeof gap === 'number') return `+${gap.toFixed(3)}`
  if (typeof gap === 'string' && gap) return gap.startsWith('+') ? gap : `+${gap}`
  return '—'
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`
  return `${m}:${s.toFixed(3).padStart(6, '0')}`
}

function completedEvent(
  meeting: Meeting,
  meetings: Meeting[],
  weekend: Weekend | undefined,
  fallback: Session[],
): WeekendCompletedEvent | undefined {
  const analysis = pickAnalysisSession(weekend, fallback)
  if (!analysis) return undefined
  return {
    meeting_key: meeting.meeting_key,
    meeting_name: meeting.meeting_name,
    country_code: meeting.country_code,
    country_flag: meeting.country_flag,
    circuit_short_name: meeting.circuit_short_name || meeting.location,
    round: meetingRound(meetings, meeting) || undefined,
    analysis_session_key: analysis.session_key,
    analysis_session_name: analysis.session_name,
    label: analysis.session_name,
    podium: [],
  }
}

function upcomingEvent(
  meeting: Meeting,
  meetings: Meeting[],
  sessions: Session[],
  now: Date,
): WeekendUpcomingEvent {
  const sorted = sortSessionsByStart(sessions)
  const nextSession = sorted.find((s) => {
    const start = sessionStartTime(s)
    return start != null && start > now
  })
  return {
    meeting_key: meeting.meeting_key,
    meeting_name: meeting.meeting_name,
    country_code: meeting.country_code,
    country_flag: meeting.country_flag,
    circuit_short_name: meeting.circuit_short_name || meeting.location,
    circuit_key: meeting.circuit_key,
    round: meetingRound(meetings, meeting) || undefined,
    date_start: meeting.date_start,
    next_session_name: nextSession?.session_name,
    next_session_start: nextSession?.date_start,
  }
}

function championshipImpact(hub: ChampionshipHub | undefined): WeekendChampionshipImpact | undefined {
  if (!hub || hub.drivers.length === 0) return undefined
  const leaders: WeekendChampionshipMover[] = hub.drivers.slice(0, 3).map((d) => {
    const cumulative = d.cumulative ?? []
    const delta =
      cumulative.length >= 2 ? cumulative[cumulative.length - 1] - cumulative[cumulative.length - 2] : undefined
    return {
      position: d.position,
      driver_number: d.driver_number,
      name_acronym: d.name_acronym,
      team_colour: d.team_colour,
      points: d.points,
      delta,
    }
  })
  const note = hub.last_race ? `Standings after ${hub.last_race}.` : undefined
  return { leaders, note }
}

function seasonRounds(
  meetings: Meeting[],
  weekendsByKey: Map<number, Weekend>,
  focusKey: number | undefined,
  now: Date,
): WeekendSeasonRound[] {
  const active = meetings.filter((m) => !m.is_cancelled)
  return active.map((meeting, index) => {
    const start = meetingStartTime(meeting)
    const end = meetingEndTime(meeting)
    let status: WeekendSeasonRound['status'] = 'upcoming'
    if (meeting.meeting_key === focusKey) status = 'next'
    else if (start && end && now > end) status = 'completed'
    else if (start && now >= start) status = 'next'
    const weekend = weekendsByKey.get(meeting.meeting_key)
    const analysis = pickAnalysisSession(weekend, [])
    return {
      round: index + 1,
      meeting_key: meeting.meeting_key,
      country_code: meeting.country_code,
      country_flag: meeting.country_flag,
      status,
      analysis_session_key: analysis?.session_key,
    }
  })
}

function briefingItems(news: NewsItem[]): WeekendContext['briefing'] {
  return news.slice(0, 3).map((item) => ({
    category: item.category,
    title: item.title,
    url: item.url,
    source: item.source,
    published_at: item.published_at,
    image_url: item.og_image_url,
  }))
}

/**
 * deriveWeekendContext resolves the current temporal Weekend state and its
 * skeleton payload from locally-available data. It is a pure function of its
 * inputs and `now`, mirroring the canonical /api/v1/weekend-context contract so
 * the two are interchangeable. Podium / story detail is fetched per-state by the
 * view components from existing analysis endpoints.
 */
export function deriveWeekendContext(inputs: WeekendContextInputs): WeekendContext {
  const { season, meetings, weekendsByKey, championship, liveActive, news, focusSessions, now } = inputs

  const base = (state: WeekendState, extra: Partial<WeekendContext> = {}): WeekendContext => ({
    state,
    season: season ?? championship?.season ?? 0,
    live: liveActive,
    championship_impact: championshipImpact(championship),
    briefing: briefingItems(news),
    ...extra,
  })

  if (!season || meetings.length === 0) {
    return base('limited_data', {
      message: 'No season data yet. Ingest a race weekend to populate the Weekend view.',
    })
  }

  const rounds = seasonRounds(meetings, weekendsByKey, undefined, now)
  const current = currentMeeting(meetings, now)
  const next = nextUpcomingMeeting(meetings, now)
  const last = mostRecentPastMeeting(meetings, now)

  const focusKey = current?.meeting_key ?? next?.meeting_key
  const withRounds = seasonRounds(meetings, weekendsByKey, focusKey, now)

  // ── Inside a current race weekend window ──
  if (current) {
    const weekend = weekendsByKey.get(current.meeting_key)
    const sessions = weekendSessions(weekend, focusSessions)
    const line = timeline(sessions, now)
    const nextSession = line.find((s) => s.status === 'next' || s.status === 'live')
    const completed = lastCompletedSession(sessions, now)
    const lastSession = completed
      ? completedEvent(current, meetings, weekend, sessions)
      : undefined
    if (lastSession && completed) {
      lastSession.analysis_session_key = completed.session_key
      lastSession.analysis_session_name = completed.session_name
      lastSession.label = completed.session_name
    }
    const anyStarted = sessions.some((s) => {
      const start = sessionStartTime(s)
      return start != null && now >= start
    })
    const allDone = sessions.length > 0 && line.every((s) => s.status === 'done')
    const settling =
      completed != null && sessionEndTime(completed) != null &&
      now.getTime() - (sessionEndTime(completed) as Date).getTime() <= SETTLING_MS

    const shared: Partial<WeekendContext> = {
      active_meeting_name: current.meeting_name,
      active_circuit_short_name: current.circuit_short_name || current.location,
      sessions: line,
      next_session: nextSession,
      last_session: lastSession,
    }

    if (liveActive || line.some((s) => s.status === 'live')) {
      return base('session_live', shared)
    }
    if (settling) {
      return base('session_settling', shared)
    }
    if (allDone) {
      // Race weekend finished but still inside its window — treat as post-weekend.
      return base('post_weekend', {
        ...shared,
        last_event: lastSession,
        next_event: next ? upcomingEvent(next, meetings, [], now) : undefined,
        season_rounds: withRounds,
      })
    }
    if (lastSession && nextSession) {
      return base('between_sessions', shared)
    }
    if (!anyStarted) {
      return base('pre_session', {
        ...shared,
        next_event: upcomingEvent(current, meetings, sessions, now),
      })
    }
    return base('between_sessions', shared)
  }

  // ── Between weekends ──
  if (last) {
    const lastWeekend = weekendsByKey.get(last.meeting_key)
    const lastEvent = completedEvent(last, meetings, lastWeekend, [])
    const lastEnd = meetingEndTime(last)
    const isPostWeekend =
      lastEnd != null && now.getTime() - lastEnd.getTime() <= POST_WEEKEND_MS

    if (next) {
      const nextWeekend = weekendsByKey.get(next.meeting_key)
      const nextSessions = weekendSessions(nextWeekend, undefined)
      return base(isPostWeekend ? 'post_weekend' : 'between_races', {
        last_event: lastEvent,
        next_event: upcomingEvent(next, meetings, nextSessions, now),
        season_rounds: withRounds,
      })
    }
    // Completed races but nothing left on the calendar.
    return base('season_complete', {
      last_event: lastEvent,
      season_rounds: rounds,
    })
  }

  // ── Season hasn't started yet: preview the opener ──
  if (next) {
    const nextWeekend = weekendsByKey.get(next.meeting_key)
    const nextSessions = weekendSessions(nextWeekend, focusSessions)
    return base('pre_session', {
      next_event: upcomingEvent(next, meetings, nextSessions, now),
      season_rounds: withRounds,
    })
  }

  return base('season_complete', { season_rounds: rounds })
}
