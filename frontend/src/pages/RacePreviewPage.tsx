import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchChampionshipHub,
  fetchMeetings,
  fetchResults,
  fetchSeasons,
  fetchSessions,
  fetchStartingGrid,
  fetchTrackOutline,
} from '../api'
import { DataNotice, RouteState } from '../components/RouteState'
import {
  aggregateNotices,
  noticeFromResponse,
  noticeMessage,
  shouldShowEmbeddedNotice,
  type DataAvailability,
} from '../lib/availability'
import { userFacingError } from '../lib/fetch'
import { countryAccent, countryFlag, formatGpDateRange } from '../lib/gpIdentity'
import {
  buildTitleFightContext,
  countdownTargetSession,
  extractPodium,
  extractPole,
  findPriorYearMeetingByCircuit,
  findRaceSession,
  formatPointsGap,
  isSprintWeekend,
  pickPreviewMeeting,
  RACE_WIN_POINTS,
  SPRINT_WEEKEND_MAX_POINTS,
} from '../lib/preview'
import { formatCountdown, formatSessionScheduleTime, sessionStartTime, sortSessionsByStart } from '../lib/schedule'
import { buildOutlinePath } from '../lib/trackmap'
import { teamColor } from '../utils'
import type { Meeting, Session, TrackOutline } from '../types'
import '../styles/preview.css'

function SectionState({
  loading,
  error,
  empty,
  emptyMessage,
  children,
}: {
  loading?: boolean
  error?: unknown
  empty?: boolean
  emptyMessage?: string
  children: ReactNode
}) {
  if (loading) {
    return <div className="preview-section-state">Loading…</div>
  }
  if (error) {
    return (
      <div className="preview-section-state error" role="status">
        {userFacingError(error)}
      </div>
    )
  }
  if (empty) {
    return <div className="preview-section-state">{emptyMessage ?? 'No data available'}</div>
  }
  return <>{children}</>
}

function TrackOutlineCard({
  outline,
  loading,
  error,
  accent,
}: {
  outline: TrackOutline | null | undefined
  loading: boolean
  error: unknown
  accent: string
}) {
  const outlinePath = useMemo(() => buildOutlinePath(outline?.points ?? []), [outline])

  return (
    <section className="preview-card" data-testid="preview-track-card">
      <h2 className="preview-card-title">Circuit</h2>
      <SectionState
        loading={loading}
        error={error}
        empty={!outline || !outlinePath}
        emptyMessage="Track outline unavailable for this circuit"
      >
        <div className="preview-track-stage" style={{ ['--preview-accent' as string]: accent }}>
          <svg className="preview-track-svg" viewBox="0 0 100 100" role="img" aria-label="Circuit outline">
            <path className="preview-track-shadow" d={outlinePath} />
            <path className="preview-track-outline" d={outlinePath} />
          </svg>
        </div>
      </SectionState>
    </section>
  )
}

function LastYearCard({
  year,
  loading,
  error,
  podium,
  pole,
  isFirstTime,
}: {
  year: number | null
  loading: boolean
  error: unknown
  podium: ReturnType<typeof extractPodium>
  pole: ReturnType<typeof extractPole>
  isFirstTime: boolean
}) {
  return (
    <section className="preview-card" data-testid="preview-last-year-card">
      <h2 className="preview-card-title">Last year here</h2>
      {year != null && !isFirstTime && <p className="preview-card-sub">{year} race weekend</p>}
      <SectionState
        loading={loading}
        error={error}
        empty={isFirstTime || podium.length === 0}
        emptyMessage={
          isFirstTime
            ? 'First time on the calendar — no prior race at this circuit'
            : 'No race results available for the previous visit'
        }
      >
        <div className="preview-podium">
          {podium.map((place) => (
            <div key={place.position} className="preview-podium-row">
              <span className="preview-podium-pos">P{place.position}</span>
              <span className="preview-podium-code" style={{ color: teamColor(place.team_colour) }}>
                {place.name_acronym}
              </span>
              <span className="preview-podium-team">{place.team_name}</span>
            </div>
          ))}
        </div>
        {pole && (
          <p className="preview-pole">
            Pole: <strong style={{ color: teamColor(pole.team_colour) }}>{pole.name_acronym}</strong>{' '}
            ({pole.team_name})
          </p>
        )}
      </SectionState>
    </section>
  )
}

function TitleFightCard({
  loading,
  error,
  drivers,
  sprintWeekend,
  season,
}: {
  loading: boolean
  error: unknown
  drivers: ReturnType<typeof buildTitleFightContext>
  sprintWeekend: boolean
  season: number | null
}) {
  return (
    <section className="preview-card preview-card--wide" data-testid="preview-title-fight-card">
      <h2 className="preview-card-title">Title fight context</h2>
      {season != null && <p className="preview-card-sub">{season} drivers&apos; championship · top 3</p>}
      <SectionState
        loading={loading}
        error={error}
        empty={drivers.length === 0}
        emptyMessage="Championship standings not available"
      >
        <table className="preview-title-table">
          <thead>
            <tr>
              <th>Driver</th>
              <th>Pts</th>
              <th>Gap</th>
              <th>If win (+{RACE_WIN_POINTS})</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.name_acronym}>
                <td>
                  <span style={{ color: teamColor(d.team_colour), fontWeight: 600 }}>{d.name_acronym}</span>
                </td>
                <td className="mono">{d.points}</td>
                <td className="mono">{formatPointsGap(d.gapToLeader)}</td>
                <td className="mono">
                  {d.position === 1 ? 'LEADER' : formatPointsGap(d.gapAfterRaceWin)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sprintWeekend && (
          <p className="preview-sprint-note" data-testid="preview-sprint-note">
            Sprint weekend: up to {SPRINT_WEEKEND_MAX_POINTS} pts available (race win {RACE_WIN_POINTS} + sprint win
            8). Max gain would reduce gaps by {SPRINT_WEEKEND_MAX_POINTS} vs a standard race win.
          </p>
        )}
      </SectionState>
    </section>
  )
}

function PreviewHeader({
  meeting,
  sessions,
  countdownSession,
  now,
  accent,
}: {
  meeting: Meeting
  sessions: Session[]
  countdownSession: Session | null
  now: Date
  accent: string
}) {
  const countdownTarget = countdownSession ? sessionStartTime(countdownSession) : null

  return (
    <header
      className="preview-header"
      data-testid="preview-header"
      style={{ ['--preview-accent' as string]: accent }}
    >
      <div className="preview-header-accent" />
      <div className="preview-header-body">
        <div className="preview-header-top">
          <div>
            <h1 className="preview-gp-name">
              {countryFlag(meeting) && <span className="preview-gp-flag">{countryFlag(meeting)}</span>}
              {meeting.meeting_name}
            </h1>
            <p className="preview-circuit">
              {meeting.circuit_short_name}
              {meeting.location ? ` · ${meeting.location}` : ''}
              {formatGpDateRange(meeting) ? ` · ${formatGpDateRange(meeting)}` : ''}
            </p>
          </div>
          {countdownTarget && (
            <div className="preview-countdown" data-testid="preview-countdown">
              <span className="preview-countdown-label">
                {countdownSession?.session_name ?? 'Next session'}
              </span>
              <span className="preview-countdown-value">{formatCountdown(countdownTarget, now)}</span>
            </div>
          )}
        </div>
        {sessions.length > 0 && (
          <div className="preview-schedule" data-testid="preview-schedule">
            {sessions.map((session) => (
              <div key={session.session_key} className="preview-schedule-item">
                <span className="preview-schedule-name">{session.session_name}</span>
                <span className="preview-schedule-time">{formatSessionScheduleTime(session.date_start)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}

export interface RacePreviewPageProps {
  /**
   * Canonical meeting identity from Weekend Context. When set, Preview must not
   * independently re-select another current meeting/session.
   */
  meeting?: Meeting
  /** Season for championship supplement; defaults to meeting.year. */
  season?: number
  /** Embedded under Weekend — identity failures stay non-blocking. */
  embedded?: boolean
  /**
   * Availability already disclosed by the Weekend shell. Embedded Preview
   * suppresses only an equivalent notice kind; distinct truth stays visible.
   */
  shellAvailability?: DataAvailability | null
}

export function RacePreviewPage({
  meeting: canonicalMeeting,
  season: canonicalSeason,
  embedded = false,
  shellAvailability = null,
}: RacePreviewPageProps = {}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const nowDate = useMemo(() => new Date(now), [now])
  const hasCanonicalMeeting = canonicalMeeting != null && canonicalMeeting.meeting_key > 0

  const seasonsQuery = useQuery({
    queryKey: ['seasons'],
    queryFn: ({ signal }) => fetchSeasons(signal),
    enabled: !hasCanonicalMeeting,
  })

  const latestSeason =
    canonicalSeason ??
    canonicalMeeting?.year ??
    seasonsQuery.data?.[0] ??
    null

  const meetingsQuery = useQuery({
    queryKey: ['meetings', latestSeason, 'auto'],
    queryFn: ({ signal }) => fetchMeetings(latestSeason!, 'auto', signal),
    enabled: !hasCanonicalMeeting && latestSeason != null,
  })

  const previewMeeting = useMemo(() => {
    if (hasCanonicalMeeting) return canonicalMeeting
    return pickPreviewMeeting(meetingsQuery.data ?? [], nowDate)
  }, [hasCanonicalMeeting, canonicalMeeting, meetingsQuery.data, nowDate])

  const sessionsQuery = useQuery({
    queryKey: ['sessions', previewMeeting?.meeting_key, 'auto'],
    queryFn: ({ signal }) => fetchSessions(previewMeeting!.meeting_key, 'auto', signal),
    enabled: previewMeeting != null,
  })

  const sessions = useMemo(
    () => sortSessionsByStart(sessionsQuery.data ?? []),
    [sessionsQuery.data],
  )

  const countdownSession = useMemo(() => countdownTargetSession(sessions, nowDate), [sessions, nowDate])
  const sprintWeekend = useMemo(() => isSprintWeekend(sessions), [sessions])

  const priorYear = previewMeeting ? previewMeeting.year - 1 : null

  const priorMeetingsQuery = useQuery({
    queryKey: ['meetings', priorYear, 'auto'],
    queryFn: ({ signal }) => fetchMeetings(priorYear!, 'auto', signal),
    enabled: priorYear != null && previewMeeting != null,
  })

  const priorMeeting = useMemo(
    () => findPriorYearMeetingByCircuit(priorMeetingsQuery.data ?? [], previewMeeting?.circuit_key),
    [priorMeetingsQuery.data, previewMeeting?.circuit_key],
  )

  const priorSessionsQuery = useQuery({
    queryKey: ['sessions', priorMeeting?.meeting_key, 'auto'],
    queryFn: ({ signal }) => fetchSessions(priorMeeting!.meeting_key, 'auto', signal),
    enabled: priorMeeting != null,
  })

  const priorRaceSession = useMemo(
    () => findRaceSession(priorSessionsQuery.data ?? []),
    [priorSessionsQuery.data],
  )

  const priorResultsQuery = useQuery({
    queryKey: ['results', priorRaceSession?.session_key, 'auto'],
    queryFn: ({ signal }) => fetchResults(priorRaceSession!.session_key, 'auto', signal),
    enabled: priorRaceSession != null,
  })

  const priorGridQuery = useQuery({
    queryKey: ['grid', priorRaceSession?.session_key, 'auto'],
    queryFn: ({ signal }) => fetchStartingGrid(priorRaceSession!.session_key, 'auto', signal),
    enabled: priorRaceSession != null,
  })

  const trackOutlineQuery = useQuery({
    queryKey: ['track-outline', previewMeeting?.circuit_key, previewMeeting?.year],
    queryFn: ({ signal }) => fetchTrackOutline(previewMeeting!.circuit_key!, previewMeeting!.year, signal),
    enabled: previewMeeting?.circuit_key != null && previewMeeting.circuit_key > 0,
  })

  const championshipQuery = useQuery({
    queryKey: ['championship-hub', latestSeason],
    queryFn: ({ signal }) => fetchChampionshipHub(latestSeason!, signal),
    enabled: latestSeason != null,
  })

  const podium = useMemo(() => extractPodium(priorResultsQuery.data ?? []), [priorResultsQuery.data])
  const pole = useMemo(() => extractPole(priorGridQuery.data ?? []), [priorGridQuery.data])
  const titleFight = useMemo(
    () => (championshipQuery.data ? buildTitleFightContext(championshipQuery.data) : []),
    [championshipQuery.data],
  )

  const accent = countryAccent(previewMeeting)
  const isFirstTimeCircuit = priorMeeting == null && priorYear != null && !priorMeetingsQuery.isLoading

  const identityLoading = !hasCanonicalMeeting && (seasonsQuery.isLoading || meetingsQuery.isLoading)
  const identityError = !hasCanonicalMeeting && (seasonsQuery.isError || meetingsQuery.isError)
  const identityRetrying = seasonsQuery.isFetching || meetingsQuery.isFetching

  const retryIdentity = () => {
    if (seasonsQuery.isError && !seasonsQuery.isFetching) void seasonsQuery.refetch()
    if (meetingsQuery.isError && !meetingsQuery.isFetching) void meetingsQuery.refetch()
  }

  // Worst reported truth across primary + supplements — Local must not mask
  // Sessions/Prior Results Stale/Partial/Limited/Archive.
  const dataNotice = aggregateNotices([
    noticeFromResponse(championshipQuery.data, { includeLocal: true }),
    noticeFromResponse(sessionsQuery.data, { includeLocal: false }),
    noticeFromResponse(priorResultsQuery.data, { includeLocal: false }),
  ])

  const showFreshnessNotice =
    Boolean(dataNotice) &&
    (!embedded || shouldShowEmbeddedNotice(dataNotice, shellAvailability))

  const sessionsFailed = sessionsQuery.isError
  const sessionsRetrying = sessionsQuery.isFetching

  const retrySessions = () => {
    if (!sessionsQuery.isFetching) void sessionsQuery.refetch()
  }

  if (identityLoading) {
    return (
      <div className={embedded ? 'preview-embedded' : 'page'} data-testid="preview-loading">
        <RouteState kind="loading" title="loading preview…" />
      </div>
    )
  }

  if (identityError) {
    const err = seasonsQuery.error ?? meetingsQuery.error
    return (
      <div className={embedded ? 'preview-embedded' : 'page'} data-testid="preview-error">
        <RouteState
          kind="error"
          title="Preview details unavailable"
          error={err}
          onRetry={() => {
            if (!identityRetrying) retryIdentity()
          }}
          retrying={identityRetrying}
          retryTestId="preview-retry"
        />
      </div>
    )
  }

  if (!previewMeeting) {
    return (
      <div className="preview-page" data-testid="preview-season-over">
        <div className="preview-empty">
          <span className="preview-empty-eyebrow mono">box-box · race preview</span>
          <h1 className="preview-empty-title">Season complete</h1>
          <p className="preview-empty-sub">
            No upcoming races on the {latestSeason ?? 'current'} calendar. Check back when the next season schedule is
            published.
          </p>
        </div>
        {titleFight.length > 0 && (
          <TitleFightCard
            loading={championshipQuery.isLoading}
            error={championshipQuery.isError ? championshipQuery.error : null}
            drivers={titleFight}
            sprintWeekend={false}
            season={latestSeason}
          />
        )}
      </div>
    )
  }

  return (
    <div
      className="preview-page"
      data-testid="preview-page"
      data-meeting-key={previewMeeting.meeting_key}
      data-embedded={embedded ? 'true' : undefined}
    >
      {showFreshnessNotice && dataNotice && (
        <DataNotice
          availability={dataNotice}
          message={noticeMessage(dataNotice)}
          testId="preview-data-notice"
        />
      )}

      {sessionsFailed && (
        <RouteState
          kind="error"
          title="Session schedule unavailable"
          error={sessionsQuery.error}
          onRetry={retrySessions}
          retrying={sessionsRetrying}
          testId="preview-sessions-error"
          retryTestId="preview-sessions-retry"
        />
      )}

      {/* Embedded Weekend already shows the canonical countdown header — skip the duplicate. */}
      {!embedded && (
        <PreviewHeader
          meeting={previewMeeting}
          sessions={sessions}
          countdownSession={countdownSession}
          now={nowDate}
          accent={accent}
        />
      )}

      {/* Embedded: still surface recovered schedule once sessions load. */}
      {embedded && sessions.length > 0 && (
        <div className="preview-schedule" data-testid="preview-schedule">
          {sessions.map((session) => (
            <div key={session.session_key} className="preview-schedule-item">
              <span className="preview-schedule-name">{session.session_name}</span>
              <span className="preview-schedule-time">
                {formatSessionScheduleTime(session.date_start)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="preview-grid">
        <TrackOutlineCard
          outline={trackOutlineQuery.data}
          loading={trackOutlineQuery.isLoading}
          error={trackOutlineQuery.isError ? trackOutlineQuery.error : null}
          accent={accent}
        />

        <LastYearCard
          year={priorMeeting?.year ?? priorYear}
          loading={priorMeetingsQuery.isLoading || priorSessionsQuery.isLoading || priorResultsQuery.isLoading}
          error={
            priorMeetingsQuery.isError
              ? priorMeetingsQuery.error
              : priorResultsQuery.isError
                ? priorResultsQuery.error
                : null
          }
          podium={podium}
          pole={pole}
          isFirstTime={isFirstTimeCircuit}
        />
      </div>

      <TitleFightCard
        loading={championshipQuery.isLoading}
        error={championshipQuery.isError ? championshipQuery.error : null}
        drivers={titleFight}
        sprintWeekend={sprintWeekend}
        season={latestSeason}
      />
    </div>
  )
}
