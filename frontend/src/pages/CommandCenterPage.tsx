import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { fetchLiveState, fetchLocalMeetings, fetchSeasons, fetchWeekend } from '../api'
import { countWeekendStats, formatCoverageHint, sessionTypeAbbrev } from '../lib/coverage'
import {
  currentAndNextSession,
  focusMeetingKind,
  formatCountdown,
  formatSessionScheduleTime,
  meetingHasStarted,
  pickFocusMeeting,
  sessionEndTime,
  sessionStartTime,
  sortSessionsByStart,
} from '../lib/schedule'
import { countryAccent, countryDecal, formatGpDateRange } from '../lib/gpIdentity'
import type { Meeting, Session, Weekend, WeekendSession } from '../types'
import { PaddockBriefing } from '../components/PaddockBriefing'

type WeekendStatusKind = 'live' | 'current' | 'next' | 'recent' | 'fallback'

function classifySessionStatus(session: Session, now: Date): 'live' | 'done' | 'upcoming' {
  const start = sessionStartTime(session)
  const end = sessionEndTime(session)
  if (start && end && now >= start && now < end) return 'live'
  if (start && now >= start) return 'done'
  return 'upcoming'
}

function collectRecentWeekends(weekends: (Weekend | undefined)[], focusKey: number | null, limit = 6) {
  const rows: Weekend[] = []
  for (const weekend of weekends) {
    if (!weekend) continue
    if (focusKey != null && weekend.meeting_key === focusKey) continue
    if (weekend.source === 'none') continue
    rows.push(weekend)
  }
  return rows
    .sort((a, b) => {
      const left = Date.parse(a.meeting.date_start ?? '')
      const right = Date.parse(b.meeting.date_start ?? '')
      return right - left
    })
    .slice(0, limit)
}

function pickAnalysisSession(weekend: Weekend | undefined): WeekendSession | undefined {
  if (!weekend) return undefined
  const local = weekend.sessions.filter((s) => s.source === 'local')
  const partial = weekend.sessions.filter((s) => s.source === 'partial')
  const pool = local.length > 0 ? local : partial.length > 0 ? partial : weekend.sessions
  const race = pool.find((s) => s.session.session_type?.toLowerCase().includes('race'))
  if (race) return race
  const qual = pool.find((s) => s.session.session_type?.toLowerCase().includes('qualifying'))
  if (qual) return qual
  return pool[0]
}

export function CommandCenterPage() {
  const [now, setNow] = useState(() => Date.now())

  const seasonsQuery = useQuery({
    queryKey: ['seasons'],
    queryFn: fetchSeasons,
  })

  const latestSeason = seasonsQuery.data?.[0] ?? null

  const meetingsQuery = useQuery({
    queryKey: ['meetings', latestSeason],
    queryFn: () => fetchLocalMeetings(latestSeason!),
    enabled: latestSeason != null,
  })

  const meetings = meetingsQuery.data ?? []

  const weekendQueries = useQueries({
    queries: meetings.map((meeting) => ({
      queryKey: ['weekend', meeting.meeting_key],
      queryFn: () => fetchWeekend(meeting.meeting_key),
      enabled: meetings.length > 0,
      staleTime: 60_000,
    })),
  })

  const liveQuery = useQuery({
    queryKey: ['live-state'],
    queryFn: fetchLiveState,
    staleTime: 5_000,
  })

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const nowDate = useMemo(() => new Date(now), [now])

  const weekendsByKey = useMemo(() => {
    const map = new Map<number, Weekend>()
    meetings.forEach((meeting, i) => {
      const data = weekendQueries[i]?.data
      if (data) map.set(meeting.meeting_key, data)
    })
    return map
  }, [meetings, weekendQueries])

  const weekendList = useMemo(() => weekendQueries.map((q) => q.data), [weekendQueries])
  const meetingStats = countWeekendStats(weekendList)
  const focusMeeting = pickFocusMeeting(meetings, nowDate)
  const focusWeekend = focusMeeting ? weekendsByKey.get(focusMeeting.meeting_key) : undefined
  const focusKind = focusMeeting ? focusMeetingKind(focusMeeting, nowDate) : null
  const focusSessions: Session[] = focusWeekend
    ? sortSessionsByStart(focusWeekend.sessions.map((s) => s.session))
    : []
  const { current: currentSession, next: nextSession } = currentAndNextSession(focusSessions, nowDate)

  const recentWeekends = collectRecentWeekends(weekendList, focusMeeting?.meeting_key ?? null)
  const analysisSession = pickAnalysisSession(focusWeekend)
  const analysisSessionKey =
    analysisSession?.session.session_key ??
    focusWeekend?.default_session_key ??
    focusWeekend?.sessions[0]?.session.session_key

  const weekendsLoading = weekendQueries.some((q) => q.isLoading)

  if (seasonsQuery.isLoading) {
    return <div className="page loading-state">loading command center…</div>
  }

  if (seasonsQuery.isError) {
    return (
      <div className="page error-box">
        {seasonsQuery.error instanceof Error ? seasonsQuery.error.message : 'Failed to load seasons'}
      </div>
    )
  }

  const seasons = seasonsQuery.data ?? []

  if (seasons.length === 0) {
    return (
      <div className="cc-page cc-empty" data-testid="command-center-empty">
        <div className="cc-empty-band">
          <span className="cc-empty-eyebrow mono">box-box · command center</span>
          <h1 className="cc-empty-title">No local data yet</h1>
          <p className="cc-empty-sub">
            Ingest a race weekend from the CLI to populate this screen with live status, next-session
            countdowns, and analysis links.
          </p>
        </div>
        <div className="cc-empty-actions">
          <Link to="/live" className="cc-action cc-action-live">
            <span className="cc-action-label">Live Timing</span>
            <span className="cc-action-meta">Standby</span>
          </Link>
          <Link to="/admin" className="cc-action">
            <span className="cc-action-label">Admin · Data Health</span>
            <span className="cc-action-meta">Ingestion guidance</span>
          </Link>
        </div>
      </div>
    )
  }

  const liveActive = liveQuery.data?.is_live === true
  const statusKind: WeekendStatusKind = liveActive
    ? 'live'
    : focusKind === 'current'
      ? 'current'
      : focusKind === 'next'
        ? 'next'
        : focusKind === 'recent'
          ? 'recent'
          : 'fallback'

  const accent = countryAccent(focusMeeting ?? null)
  const decal = countryDecal(focusMeeting ?? null)
  const accentStyle = { '--gp-accent': accent } as React.CSSProperties

  return (
    <div className="cc-page" data-testid="command-center" style={accentStyle}>
      <div className="cc-topbar">
        <span className="cc-topbar-label mono">box-box · command center</span>
        <span className="cc-topbar-meta mono">
          {latestSeason} season · {meetingStats.full}/{meetingStats.total || 0} weekends full
        </span>
        <span className="cc-live-pill" data-testid="cc-live-status">
          <span className={`cc-live-dot ${liveActive ? 'live' : ''}`} />
          {liveActive ? 'Live session active' : 'No live session'}
        </span>
      </div>

      {!focusMeeting && (
        <div className="missing-notice">
          No meetings ingested for {latestSeason}. Run{' '}
          <code>box-box --ingest-year {latestSeason}</code>
        </div>
      )}

      {focusMeeting && (
        <section className="cc-weekend-band" data-testid="cc-focus">
          <div className="cc-band-accent" aria-hidden="true" />
          <div className="cc-band-body">
            <div className="cc-band-row">
              <span className="cc-band-decal mono">{decal}</span>
              <div className="cc-band-titles">
                <div className="cc-band-eyebrow mono">
                  <WeekendKindLabel kind={statusKind} />
                </div>
                <h1 className="cc-band-name">{focusMeeting.meeting_name}</h1>
                <div className="cc-band-sub mono">
                  {[focusMeeting.location, focusMeeting.circuit_short_name]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <div className="cc-band-sub mono cc-band-dates">{formatGpDateRange(focusMeeting)}</div>
              </div>
              <CountdownBlock
                liveActive={liveActive}
                currentSession={currentSession}
                nextSession={nextSession}
                meeting={focusMeeting}
                now={nowDate}
              />
            </div>
          </div>
        </section>
      )}

      {focusMeeting && (
        <div className="cc-actions-row" data-testid="cc-actions">
          <Link
            to="/live"
            className={`cc-pri-action ${liveActive ? 'is-live' : ''}`}
            data-testid="cc-action-live"
          >
            <span className="cc-pri-label">Watch Live</span>
            <span className="cc-pri-meta mono">{liveActive ? 'Feed active' : 'Standby'}</span>
          </Link>
          <Link
            to="/race-hub"
            search={analysisSessionKey ? { session_key: analysisSessionKey } : {}}
            className="cc-pri-action"
            data-testid="cc-action-race-hub"
          >
            <span className="cc-pri-label">Open Analysis</span>
            <span className="cc-pri-meta mono">
              {analysisSession
                ? `${analysisSession.session.session_name} · session ${analysisSession.session.session_key}`
                : 'Pick a session'}
            </span>
          </Link>
          {nextSession && sessionStartTime(nextSession) && (
            <a
              href="#cc-schedule"
              className="cc-pri-action"
              data-testid="cc-action-schedule"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('cc-schedule')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <span className="cc-pri-label">Schedule</span>
              <span className="cc-pri-meta mono">
                next: {nextSession.session_name}
              </span>
            </a>
          )}
        </div>
      )}

      {focusWeekend && focusWeekend.sessions.length > 0 && (
        <section className="cc-schedule" id="cc-schedule">
          <div className="sec-header">
            <span className="sec-title">Weekend Schedule</span>
            <span className="sec-meta mono">{focusWeekend.sessions.length} sessions</span>
          </div>
          <div className="cc-session-strip" role="list">
            {focusWeekend.sessions.map(({ session, source, datasets }) => {
              const status = classifySessionStatus(session, nowDate)
              const isNext = nextSession?.session_key === session.session_key
              const isCurrent = currentSession?.session_key === session.session_key
              return (
                <Link
                  key={session.session_key}
                  to="/race-hub"
                  search={{ session_key: session.session_key }}
                  className={`cc-session-card cc-status-${status}${isNext ? ' is-next' : ''}${
                    isCurrent ? ' is-current' : ''
                  }`}
                  data-testid={`cc-session-${session.session_key}`}
                  role="listitem"
                >
                  <div className="cc-session-card-head">
                    <span className="cc-session-abbrev mono">
                      {sessionTypeAbbrev(session.session_type, session.session_name)}
                    </span>
                    <span className={`cc-session-status cc-status-pill-${status}`}>
                      {isCurrent ? 'On track' : status === 'done' ? 'Done' : isNext ? 'Next' : 'Upcoming'}
                    </span>
                  </div>
                  <div className="cc-session-name">{session.session_name}</div>
                  <div className="cc-session-time mono">{formatSessionScheduleTime(session.date_start)}</div>
                  <div className="cc-session-cov mono">
                    <span className={`cc-cov-dot cc-cov-${source}`} aria-hidden="true" />
                    {formatCoverageHint(datasets)}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {(weekendsLoading || recentWeekends.length > 0) && (
        <section className="cc-recent">
          <div className="sec-header">
            <span className="sec-title">Recent Local Weekends</span>
            <span className="sec-meta mono">{recentWeekends.length}</span>
          </div>
          {weekendsLoading && recentWeekends.length === 0 ? (
            <div className="loading-state">loading weekends…</div>
          ) : recentWeekends.length === 0 ? (
            <div className="cc-side-empty">No additional local weekends.</div>
          ) : (
            <div className="cc-recent-strip" role="list">
              {recentWeekends.map((weekend) => {
                const finished = meetingHasStarted(weekend.meeting, nowDate)
                const target = pickAnalysisSession(weekend)
                const target_key = target?.session.session_key ?? weekend.default_session_key
                return (
                  <Link
                    key={weekend.meeting_key}
                    to="/race-hub"
                    search={target_key ? { session_key: target_key } : {}}
                    className="cc-recent-card"
                    data-testid={`cc-weekend-${weekend.meeting_key}`}
                    role="listitem"
                  >
                    <div className="cc-recent-head mono">
                      <span className="cc-recent-decal">{countryDecal(weekend.meeting)}</span>
                      <span className={`cc-cov-dot cc-cov-${weekend.source}`} aria-hidden="true" />
                    </div>
                    <div className="cc-recent-name">{weekend.meeting.meeting_name}</div>
                    <div className="cc-recent-meta mono">
                      {formatGpDateRange(weekend.meeting)}
                      {' · '}
                      {finished ? 'Past' : 'Upcoming'}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      )}

      <PaddockBriefing />
    </div>
  )
}

function WeekendKindLabel({ kind }: { kind: WeekendStatusKind }) {
  switch (kind) {
    case 'live':
      return <span className="cc-kind cc-kind-live">● Live now</span>
    case 'current':
      return <span className="cc-kind cc-kind-current">Current weekend</span>
    case 'next':
      return <span className="cc-kind cc-kind-next">Next weekend</span>
    case 'recent':
      return <span className="cc-kind cc-kind-recent">Recent weekend</span>
    default:
      return <span className="cc-kind">Weekend</span>
  }
}

interface CountdownBlockProps {
  liveActive: boolean
  currentSession: Session | null
  nextSession: Session | null
  meeting: Meeting
  now: Date
}

function CountdownBlock({ liveActive, currentSession, nextSession, meeting, now }: CountdownBlockProps) {
  if (liveActive) {
    return (
      <div className="cc-countdown-block">
        <div className="cc-cd-label mono">SignalR</div>
        <div className="cc-cd-value cc-cd-live">LIVE</div>
        <div className="cc-cd-sub mono">{currentSession?.session_name ?? 'Feed connected'}</div>
      </div>
    )
  }
  if (currentSession) {
    return (
      <div className="cc-countdown-block">
        <div className="cc-cd-label mono">On Track</div>
        <div className="cc-cd-value cc-cd-current">{currentSession.session_name}</div>
        <div className="cc-cd-sub mono">In session</div>
      </div>
    )
  }
  if (nextSession && sessionStartTime(nextSession)) {
    return (
      <div className="cc-countdown-block">
        <div className="cc-cd-label mono">Next · {nextSession.session_name}</div>
        <div className="cc-cd-value mono">{formatCountdown(sessionStartTime(nextSession)!, now)}</div>
        <div className="cc-cd-sub mono">{formatSessionScheduleTime(nextSession.date_start)}</div>
      </div>
    )
  }
  if (meetingHasStarted(meeting, now)) {
    return (
      <div className="cc-countdown-block">
        <div className="cc-cd-label mono">Status</div>
        <div className="cc-cd-value cc-cd-done">Complete</div>
        <div className="cc-cd-sub mono">Weekend finished</div>
      </div>
    )
  }
  return null
}
