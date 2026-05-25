import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { fetchLiveState, fetchLocalMeetings, fetchSeasons, fetchWeekend } from '../api'
import { countWeekendStats, formatCoverageHint, sessionTypeAbbrev } from '../lib/coverage'
import {
  currentAndNextSession,
  focusMeetingKind,
  focusMeetingLabel,
  formatCountdown,
  formatSessionScheduleTime,
  meetingHasStarted,
  pickFocusMeeting,
  sessionStartTime,
  sortSessionsByStart,
} from '../lib/schedule'
import { SourceBadge, weekendStatusLabel } from '../components/SourceBadge'
import { CliCommands } from '../components/CliCommands'
import type { Meeting, Weekend, WeekendSession } from '../types'

function formatMeetingDates(meeting: Meeting): string {
  const start = meeting.date_start?.slice(0, 10)
  const end = meeting.date_end?.slice(0, 10)
  if (start && end && start !== end) return `${start} – ${end}`
  return start || end || '—'
}

function countSessionStats(weekends: (Weekend | undefined)[]) {
  let local = 0
  let partial = 0
  let total = 0

  for (const weekend of weekends) {
    if (!weekend) continue
    for (const entry of weekend.sessions) {
      total++
      if (entry.source === 'local') local++
      else if (entry.source === 'partial') partial++
    }
  }

  return { local, partial, total }
}

function collectRecentSessions(weekends: (Weekend | undefined)[], limit = 8) {
  const rows: Array<WeekendSession & { meeting: Meeting }> = []

  for (const weekend of weekends) {
    if (!weekend) continue
    for (const entry of weekend.sessions) {
      rows.push({ ...entry, meeting: weekend.meeting })
    }
  }

  return rows
    .sort((a, b) => {
      const left = Date.parse(a.session.date_start)
      const right = Date.parse(b.session.date_start)
      return right - left
    })
    .slice(0, limit)
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
  const sessionStats = countSessionStats(weekendList)
  const focusMeeting = pickFocusMeeting(meetings, nowDate)
  const focusWeekend = focusMeeting ? weekendsByKey.get(focusMeeting.meeting_key) : undefined
  const focusKind = focusMeeting ? focusMeetingKind(focusMeeting, nowDate) : null
  const focusSessions = focusWeekend ? sortSessionsByStart(focusWeekend.sessions.map((s) => s.session)) : []
  const { current: currentSession, next: nextSession } = currentAndNextSession(focusSessions, nowDate)
  const defaultSessionKey = focusWeekend?.default_session_key ?? focusWeekend?.sessions[0]?.session.session_key
  const recentSessions = collectRecentSessions(weekendList)
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
      <div className="cc-page" data-testid="command-center-empty">
        <div className="cc-header">
          <h1 className="cc-title">Command Center</h1>
          <span className="cc-subtitle">Local-first F1 operations</span>
        </div>
        <div className="empty-state">
          <div className="empty-state-title">No ingested seasons yet</div>
          <div className="empty-state-desc">
            Ingest a season or session from the CLI, then return here for coverage and navigation.
          </div>
        </div>
        <div className="cc-cli-section">
          <div className="sec-header">
            <span className="sec-title">Get Started</span>
          </div>
          <CliCommands
            commands={[
              { comment: '# Discover season meetings and sessions', cmd: 'box-box --ingest-year 2025' },
              { comment: '# Ingest a full weekend or single session', cmd: 'box-box --ingest-meeting <meeting_key>' },
            ]}
          />
        </div>
      </div>
    )
  }

  const liveActive = liveQuery.data?.is_live === true

  return (
    <div className="cc-page" data-testid="command-center">
      <div className="cc-header">
        <div>
          <h1 className="cc-title">Command Center</h1>
          <span className="cc-subtitle">
            {latestSeason} season · {seasons.length} season{seasons.length === 1 ? '' : 's'} local
          </span>
        </div>
        <div className="cc-live-pill" data-testid="cc-live-status">
          <span className={`cc-live-dot ${liveActive ? 'live' : ''}`} />
          {liveActive ? 'Live session active' : 'No live session'}
        </div>
      </div>

      <div className="cc-summary">
        <div className="cc-stat">
          <span className="cc-stat-label">Seasons</span>
          <span className="cc-stat-val">{seasons.length}</span>
        </div>
        <div className="cc-stat">
          <span className="cc-stat-label">Weekends Full</span>
          <span className="cc-stat-val cc-stat-full">{meetingStats.full}</span>
        </div>
        <div className="cc-stat">
          <span className="cc-stat-label">Partial</span>
          <span className="cc-stat-val cc-stat-partial">{meetingStats.partial}</span>
        </div>
        <div className="cc-stat">
          <span className="cc-stat-label">Missing</span>
          <span className="cc-stat-val">{meetingStats.missing}</span>
        </div>
        <div className="cc-stat">
          <span className="cc-stat-label">Sessions Local</span>
          <span className="cc-stat-val">
            {sessionStats.local}/{sessionStats.total || '—'}
          </span>
        </div>
      </div>

      <div className="cc-grid">
        <section className="cc-panel" data-testid="cc-focus">
          <div className="sec-header">
            <span className="sec-title">{focusKind ? focusMeetingLabel(focusKind) : 'Weekend'}</span>
            {focusWeekend && (
              <SourceBadge source={focusWeekend.source} label={weekendStatusLabel(focusWeekend.source)} />
            )}
          </div>

          {meetingsQuery.isLoading && <div className="loading-state">loading meetings…</div>}

          {meetingsQuery.isError && (
            <div className="error-box">
              {meetingsQuery.error instanceof Error
                ? meetingsQuery.error.message
                : 'Failed to load meetings'}
            </div>
          )}

          {!meetingsQuery.isLoading && !meetingsQuery.isError && focusMeeting && (
            <>
              <div className="cc-focus-head">
                <div>
                  <div className="cc-focus-name">{focusMeeting.meeting_name}</div>
                  <div className="cc-focus-meta mono">
                    {focusMeeting.location}
                    {focusMeeting.country_code ? ` · ${focusMeeting.country_code}` : ''}
                    {' · '}
                    {formatMeetingDates(focusMeeting)}
                  </div>
                </div>
                {focusMeeting.circuit_short_name && (
                  <span className="cc-circuit mono">{focusMeeting.circuit_short_name}</span>
                )}
              </div>

              <div className="cc-focus-status">
                {liveActive && (
                  <div className="cc-status-row">
                    <span className="badge badge-live">LIVE</span>
                    <span>SignalR feed connected — open Live Timing</span>
                  </div>
                )}
                {currentSession && (
                  <div className="cc-status-row">
                    <span className="badge badge-live">ON TRACK</span>
                    <span>{currentSession.session_name}</span>
                  </div>
                )}
                {!currentSession && nextSession && sessionStartTime(nextSession) && (
                  <div className="cc-status-row">
                    <span className="cc-status-label">Next session</span>
                    <span className="cc-status-value">{nextSession.session_name}</span>
                    <span className="cc-countdown mono">
                      {formatCountdown(sessionStartTime(nextSession)!, nowDate)}
                    </span>
                  </div>
                )}
                {!currentSession && !nextSession && focusMeeting && meetingHasStarted(focusMeeting, nowDate) && (
                  <div className="cc-status-row muted">Weekend finished</div>
                )}
                {!currentSession && !nextSession && focusKind === 'recent' && (
                  <div className="cc-status-row muted">Historical weekend — local data available</div>
                )}
              </div>

              {weekendsLoading && !focusWeekend && (
                <div className="loading-state">loading weekend schedule…</div>
              )}

              {focusWeekend && focusWeekend.sessions.length > 0 && (
                <div className="scroll-x">
                  <table className="data-table cc-schedule-table">
                    <thead>
                      <tr>
                        <th>Session</th>
                        <th>Start</th>
                        <th>Coverage</th>
                        <th className="r">Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {focusWeekend.sessions.map(({ session, source, datasets }) => {
                        const isCurrent = currentSession?.session_key === session.session_key
                        const isNext = nextSession?.session_key === session.session_key
                        return (
                          <tr
                            key={session.session_key}
                            className={isCurrent ? 'cc-row-live' : isNext ? 'cc-row-next' : ''}
                          >
                            <td>
                              <span className="cc-session-type">
                                {sessionTypeAbbrev(session.session_type, session.session_name)}
                              </span>
                              <span style={{ fontWeight: 600 }}>{session.session_name}</span>
                              {session.session_key === focusWeekend.default_session_key && (
                                <span className="nav-sub">default</span>
                              )}
                            </td>
                            <td className="mono" style={{ color: 'var(--text-2)' }}>
                              {formatSessionScheduleTime(session.date_start)}
                            </td>
                            <td>
                              <span className="mono" style={{ color: 'var(--text-2)' }}>
                                {formatCoverageHint(datasets)}
                              </span>
                              <SourceBadge source={source} />
                            </td>
                            <td className="r">
                              <Link
                                to="/race-hub"
                                search={{ session_key: session.session_key }}
                                className="nav-action-btn nav-action-primary"
                              >
                                Race Hub
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {!meetingsQuery.isLoading && meetings.length === 0 && (
            <div className="missing-notice">
              No meetings ingested for {latestSeason}. Run{' '}
              <code>box-box --ingest-year {latestSeason}</code>
            </div>
          )}
        </section>

        <aside className="cc-side">
          <section className="cc-panel">
            <div className="sec-header">
              <span className="sec-title">Quick Actions</span>
            </div>
            <div className="cc-actions">
              <Link to="/live" className="cc-action" data-testid="cc-action-live">
                <span className="cc-action-label">Live Timing</span>
                <span className="cc-action-meta">{liveActive ? 'Session active' : 'Standby'}</span>
              </Link>
              <Link
                to="/race-hub"
                search={defaultSessionKey ? { session_key: defaultSessionKey } : {}}
                className="cc-action"
                data-testid="cc-action-race-hub"
              >
                <span className="cc-action-label">Race Hub</span>
                <span className="cc-action-meta">
                  {defaultSessionKey ? `session ${defaultSessionKey}` : 'Pick a session'}
                </span>
              </Link>
              <Link to="/data-library" className="cc-action" data-testid="cc-action-data-library">
                <span className="cc-action-label">Data Library</span>
                <span className="cc-action-meta">
                  {meetingStats.full}/{meetingStats.total || 0} weekends full
                </span>
              </Link>
            </div>
          </section>

          <section className="cc-panel">
            <div className="sec-header">
              <span className="sec-title">Local Sessions</span>
              <span className="sec-meta">{recentSessions.length}</span>
            </div>
            {weekendsLoading && recentSessions.length === 0 && (
              <div className="loading-state">loading sessions…</div>
            )}
            {recentSessions.length === 0 && !weekendsLoading && (
              <div className="cc-side-empty">No local sessions ingested yet.</div>
            )}
            {recentSessions.length > 0 && (
              <div className="cc-session-list">
                {recentSessions.map(({ session, source, datasets, meeting }) => (
                  <Link
                    key={session.session_key}
                    to="/race-hub"
                    search={{ session_key: session.session_key }}
                    className="cc-session-row"
                    data-testid={`cc-session-${session.session_key}`}
                  >
                    <div>
                      <div className="cc-session-row-title">
                        {meeting.meeting_name} · {session.session_name}
                      </div>
                      <div className="cc-session-row-meta mono">
                        {session.session_key} · {formatCoverageHint(datasets)}
                      </div>
                    </div>
                    <SourceBadge source={source} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
