import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  fetchChampionshipHub,
  fetchLiveState,
  fetchLocalMeetings,
  fetchRaceHub,
  fetchSeasonMeetings,
  fetchSeasons,
  fetchSessions,
  fetchWeekend,
} from '../api'
import { CommandCenterHero } from '../components/CommandCenterHero'
import { PaddockBriefing } from '../components/PaddockBriefing'
import { RACE_HUB_DATASETS, countWeekendStats, formatCoverageHint, sessionTypeAbbrev } from '../lib/coverage'
import { countryAccent, countryDecal, countryFlag, formatGpDateRange } from '../lib/gpIdentity'
import { classifySessionStatus, heroState } from '../lib/hero'
import {
  currentAndNextSession,
  focusMeetingKind,
  formatSessionScheduleTime,
  meetingHasStarted,
  mostRecentPastMeeting,
  nextUpcomingMeeting,
  pickFocusMeeting,
  sortSessionsByStart,
} from '../lib/schedule'
import type { Meeting, Session, Weekend, WeekendSession } from '../types'
import { Trophy } from 'lucide-react'

const missingDatasets = Object.fromEntries(
  RACE_HUB_DATASETS.map((dataset) => [dataset, { status: 'missing', source: 'none', count: 0 }]),
) as WeekendSession['datasets']

function meetingStatus(meeting: Meeting, focusKey: number | undefined, now: Date) {
  if (meeting.meeting_key === focusKey) return 'focus'
  if (meetingHasStarted(meeting, now)) return 'past'
  return 'future'
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

  const seasonMeetingsQuery = useQuery({
    queryKey: ['season-meetings', latestSeason],
    queryFn: () => fetchSeasonMeetings(latestSeason!),
    enabled: latestSeason != null,
  })

  const localMeetings = meetingsQuery.data ?? []
  const seasonMeetings = seasonMeetingsQuery.data?.length ? seasonMeetingsQuery.data : localMeetings
  const focusMeetings = seasonMeetings.length > 0 ? seasonMeetings : localMeetings

  const weekendQueries = useQueries({
    queries: localMeetings.map((meeting) => ({
      queryKey: ['weekend', meeting.meeting_key],
      queryFn: () => fetchWeekend(meeting.meeting_key),
      enabled: localMeetings.length > 0,
      staleTime: 60_000,
    })),
  })

  const liveQuery = useQuery({
    queryKey: ['live-state'],
    queryFn: fetchLiveState,
    staleTime: 5_000,
  })

  const championshipQuery = useQuery({
    queryKey: ['championship-hub', latestSeason],
    queryFn: () => fetchChampionshipHub(latestSeason!),
    enabled: latestSeason != null,
  })
  const champHub = championshipQuery.data

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const nowDate = useMemo(() => new Date(now), [now])

  const weekendsByKey = useMemo(() => {
    const map = new Map<number, Weekend>()
    localMeetings.forEach((meeting, i) => {
      const data = weekendQueries[i]?.data
      if (data) map.set(meeting.meeting_key, data)
    })
    return map
  }, [localMeetings, weekendQueries])

  const weekendList = useMemo(() => weekendQueries.map((q) => q.data), [weekendQueries])
  const meetingStats = countWeekendStats(weekendList)
  const focusMeeting = pickFocusMeeting(focusMeetings, nowDate)
  const focusWeekend = focusMeeting ? weekendsByKey.get(focusMeeting.meeting_key) : undefined
  const openF1SessionsQuery = useQuery({
    queryKey: ['sessions', focusMeeting?.meeting_key, 'openf1'],
    queryFn: () => fetchSessions(focusMeeting!.meeting_key, 'openf1'),
    enabled: focusMeeting != null && focusWeekend == null,
    staleTime: 60_000,
  })
  const openF1WeekendSessions: WeekendSession[] = useMemo(
    () =>
      (openF1SessionsQuery.data ?? []).map((session) => ({
        session,
        source: 'none',
        datasets: missingDatasets,
      })),
    [openF1SessionsQuery.data],
  )
  const focusWeekendSessions = focusWeekend?.sessions ?? openF1WeekendSessions
  const focusKind = focusMeeting ? focusMeetingKind(focusMeeting, nowDate) : null
  const focusSessions: Session[] = sortSessionsByStart(focusWeekendSessions.map((s) => s.session))
  const { current: currentSession, next: nextSession } = currentAndNextSession(focusSessions, nowDate)

  const analysisSession = pickAnalysisSession(focusWeekend)
  const actionSession =
    analysisSession?.session ??
    currentSession ??
    nextSession ??
    focusWeekendSessions.find((s) => s.session.session_key === focusWeekend?.default_session_key)?.session ??
    focusWeekendSessions[0]?.session
  const analysisSessionKey = actionSession?.session_key

  const liveActive = liveQuery.data?.is_live === true
  const heroStateKind = heroState({
    now: nowDate,
    liveActive,
    currentSession,
    focusKind,
  })

  const lastPastMeeting = useMemo(
    () => mostRecentPastMeeting(focusMeetings, nowDate),
    [focusMeetings, nowDate],
  )
  const lastPastWeekend = lastPastMeeting ? weekendsByKey.get(lastPastMeeting.meeting_key) : undefined
  const lastRaceAnalysis = pickAnalysisSession(lastPastWeekend)
  const lastRaceSessionKey = lastRaceAnalysis?.session.session_key

  const lastRaceHubQuery = useQuery({
    queryKey: ['race-hub', lastRaceSessionKey, 'hero-podium'],
    queryFn: () => fetchRaceHub(lastRaceSessionKey!),
    enabled: lastRaceSessionKey != null && heroStateKind === 'between',
    staleTime: 60_000,
  })

  const nextMeetingForHero = useMemo(() => {
    if (heroStateKind !== 'between') return null
    return nextUpcomingMeeting(focusMeetings, nowDate)
  }, [heroStateKind, focusMeetings, nowDate])

  const lastRacePodium = lastRaceHubQuery.data?.results ?? []
  const lastRaceName = champHub?.last_race ?? lastPastMeeting?.meeting_name ?? ''
  const focusNarrative =
    heroStateKind === 'between'
      ? lastRaceName
        ? `${lastRaceName} is in the archive. The next chapter begins at ${focusMeeting?.circuit_short_name || focusMeeting?.meeting_name || 'the next round'}.`
        : 'The season is between race weekends. Use the timeline to revisit a completed round or look ahead.'
      : currentSession
        ? `${currentSession.session_name} is the active chapter of this weekend. Session detail remains available as it lands locally.`
        : nextSession
          ? `${nextSession.session_name} is next on the timetable. The weekend rail keeps every session and its local analysis in reach.`
          : 'The weekend timetable is ready to explore.'

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

  const accent = countryAccent(focusMeeting ?? null)
  const accentStyle = { '--gp-accent': accent } as React.CSSProperties

  return (
    <div className="cc-page" data-testid="command-center" style={accentStyle}>
      <div className="cc-topbar">
        <span className="cc-topbar-label mono">box-box · command center</span>
        <span className="cc-topbar-meta mono">
          {latestSeason} season · weekend desk
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

      {focusMeeting && focusKind && (
        <CommandCenterHero
          state={heroStateKind}
          now={nowDate}
          accent={accent}
          liveActive={liveActive}
          liveData={liveQuery.data?.data}
          focusMeeting={focusMeeting}
          focusKind={focusKind}
          sessions={focusWeekendSessions}
          currentSession={currentSession}
          nextSession={nextSession}
          analysisSessionKey={analysisSessionKey}
          analysisSessionName={actionSession?.session_name}
          lastRaceName={lastRaceName}
          lastRacePodium={lastRacePodium}
          lastRaceSessionKey={lastRaceSessionKey}
          nextMeeting={nextMeetingForHero}
        />
      )}

      {focusMeeting && (
        <section className="cc-context" data-testid="cc-circuit-context">
          <div className="cc-context-decal mono" aria-hidden="true">
            {countryDecal(focusMeeting)}
          </div>
          <div className="cc-context-copy">
            <span className="cc-context-kicker mono">Circuit context</span>
            <h2>{focusMeeting.circuit_short_name || focusMeeting.meeting_name}</h2>
            <p>{focusNarrative}</p>
          </div>
          <div className="cc-context-meta mono">
            <span>{focusMeeting.location || focusMeeting.country_name}</span>
            <span>{formatGpDateRange(focusMeeting)}</span>
            <Link to="/preview" className="cc-context-preview">
              Weekend preview →
            </Link>
          </div>
        </section>
      )}

      <div className="cc-dashboard-grid">
        <div className="cc-dashboard-main">
          <div 
            className="cc-ambient-aura" 
            aria-hidden="true" 
            style={focusMeeting ? { '--aura-accent': countryAccent(focusMeeting) } as React.CSSProperties : undefined} 
          />
          <div className="cc-dashboard-panel">
            {seasonMeetings.length > 0 && (
              <section className="cc-season-calendar" data-testid="cc-season-calendar">
              <div className="sec-header">
                <span className="sec-title">Season Calendar</span>
                <span className="sec-meta mono">
                  {seasonMeetings.length} rounds · {meetingStats.full}/{meetingStats.total || 0} local
                </span>
              </div>
              <div className="cc-calendar-grid" role="list">
                {seasonMeetings.map((meeting, index) => {
                  const weekend = weekendsByKey.get(meeting.meeting_key)
                  const target = pickAnalysisSession(weekend)
                  const targetKey = target?.session.session_key ?? weekend?.default_session_key
                  const status = meetingStatus(meeting, focusMeeting?.meeting_key, nowDate)
                  const cardAccent = countryAccent(meeting)
                  return (
                    <Link
                      key={meeting.meeting_key}
                      to="/race-hub"
                      search={targetKey ? { session_key: targetKey } : {}}
                      className={`cc-calendar-card cc-calendar-${status}`}
                      data-testid={`cc-calendar-${meeting.meeting_key}`}
                      role="listitem"
                      style={{ '--gp-card-accent': cardAccent } as React.CSSProperties}
                    >
                      <div className="cc-calendar-accent" aria-hidden="true" />
                      <div className="cc-calendar-top mono">
                        <span className="cc-calendar-round">R{String(index + 1).padStart(2, '0')}</span>
                        <span className={`cc-calendar-status cc-calendar-status-${status}`}>
                          {status === 'past' ? 'Archive' : status === 'focus' ? 'Now' : 'Ahead'}
                        </span>
                      </div>
                      <div className="cc-calendar-id">
                        {countryFlag(meeting) && <span className="cc-calendar-flag">{countryFlag(meeting)}</span>}
                      </div>
                      <span className="cc-calendar-decal mono">{countryDecal(meeting)}</span>
                      <div className="cc-calendar-copy">
                        <div className="cc-calendar-name">{meeting.meeting_name}</div>
                        <div className="cc-calendar-circuit mono">{meeting.circuit_short_name || meeting.location}</div>
                        <div className="cc-calendar-date mono">{formatGpDateRange(meeting)}</div>
                      </div>
                    </Link>
                  )
                })}
              </div>
              {seasonMeetingsQuery.isError && (
                <div className="cc-side-empty">Using local meetings because the full calendar could not load.</div>
              )}
            </section>
            )}
          </div>
        </div>

        <div className="cc-dashboard-sidebar">
          {champHub && (
            <section className="cc-champ-snapshot glass-panel" data-testid="cc-champ-snapshot" style={{ padding: 'var(--s5)', borderRadius: '12px' }}>
              <div className="cc-champ-header">
                <span>Championship Leaders</span>
                <Link to="/championship" className="cc-champ-link">Full Standings →</Link>
              </div>
              <div className="cc-champ-group-label">Drivers</div>
              <div className="cc-champ-list">
                {champHub.drivers.slice(0, 3).map((d) => (
                  <div key={d.driver_number} className="cc-champ-row">
                    <div className="cc-champ-left">
                      <div className="cc-champ-color" style={{ color: `#${d.team_colour}`, background: 'currentColor' }} />
                      <span className="cc-champ-name">{d.name_acronym}</span>
                    </div>
                    <div className="cc-champ-form" title="Last 5 races">
                      <FormSparkline form={d.form} color={`#${d.team_colour}`} />
                    </div>
                    <div className="cc-champ-right">
                      <span className="cc-champ-gap">
                        {d.position === 1 ? '—' : `-${champHub.drivers[0].points - d.points}`}
                      </span>
                      <span className="cc-champ-pts">{d.points}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="cc-champ-group-label">Constructors</div>
              <div className="cc-champ-list">
                {champHub.teams.slice(0, 3).map((t, i) => (
                  <div key={t.team_name} className="cc-champ-row">
                    <div className="cc-champ-left">
                      <div className="cc-champ-color" style={{ color: `#${t.team_colour}`, background: 'currentColor' }} />
                      <span className="cc-champ-name">{t.team_name}</span>
                    </div>
                    <div className="cc-champ-form" style={{ opacity: 0.4, fontSize: '11px', display: 'flex', gap: '4px', alignItems: 'center' }} title={`${t.wins} Wins`}>
                      <Trophy size={12} /> {t.wins}
                    </div>
                    <div className="cc-champ-right">
                      <span className="cc-champ-gap">
                        {i === 0 ? '—' : `-${champHub.teams[0].points - t.points}`}
                      </span>
                      <span className="cc-champ-pts">{t.points}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {focusWeekendSessions.length > 0 && (
            <section className="cc-schedule" data-testid="cc-schedule">
              <div className="sec-header">
                <span className="sec-title">Weekend Schedule</span>
                <span className="sec-meta mono">{focusWeekendSessions.length} sessions</span>
              </div>
              <div className="cc-session-strip" role="list">
                {focusWeekendSessions.map(({ session, source, datasets }) => {
                  const status = classifySessionStatus(session, nowDate)
                  const isNext = nextSession?.session_key === session.session_key
                  const isCurrent = currentSession?.session_key === session.session_key
                  const isLive = isCurrent && liveActive
                  return (
                    <Link
                      key={session.session_key}
                      to="/race-hub"
                      search={{ session_key: session.session_key }}
                      className={`cc-session-card ui-card interactive cc-status-${status}${isNext ? ' is-next' : ''}${
                        isLive ? ' is-live glass-panel' : ''
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
                      <div className="cc-session-cov mono" title={formatCoverageHint(datasets)}>
                        <span className={`cc-cov-dot cc-cov-${source}`} aria-hidden="true" />
                        {source === 'local' ? 'Analysis ready' : formatCoverageHint(datasets)}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          <PaddockBriefing />
          <div className="cc-data-note mono" data-testid="cc-data-note">
            <span className="cc-cov-dot cc-cov-local" aria-hidden="true" />
            {meetingStats.full}/{meetingStats.total || 0} locally complete · availability is shown per session
          </div>
        </div>
      </div>
    </div>
  )
}

function FormSparkline({ form, color }: { form: number[], color: string }) {
  if (!form || form.length === 0) return null
  const max = Math.max(...form, 26) // 26 is standard max for a race win
  const width = 45
  const height = 14
  const step = width / Math.max(form.length - 1, 1)

  const points = form.map((val, i) => {
    const x = i * step
    const y = height - (val / max) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}
