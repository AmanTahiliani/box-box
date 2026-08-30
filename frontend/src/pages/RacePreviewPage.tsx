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
  error?: Error | null
  empty?: boolean
  emptyMessage?: string
  children: ReactNode
}) {
  if (loading) {
    return <div className="preview-section-state">Loading…</div>
  }
  if (error) {
    return (
      <div className="preview-section-state error">
        {error instanceof Error ? error.message : 'Failed to load'}
      </div>
    )
  }
  if (empty) {
    return <div className="preview-section-state">{emptyMessage ?? 'No data available'}</div>
  }
  return <>{children}</>
}

function circuitIdentity(meeting: Meeting): { name: string; place: string } {
  const name = meeting.circuit_short_name?.trim() || meeting.meeting_name
  const location = meeting.location?.trim() ?? ''
  const country = meeting.country_name?.trim() ?? ''
  const parts: string[] = []
  if (location) parts.push(location)
  if (country && country !== location) parts.push(country)
  return { name, place: parts.join(' · ') }
}

function TrackOutlineCard({
  meeting,
  outline,
  loading,
  error,
  accent,
}: {
  meeting: Meeting
  outline: TrackOutline | null | undefined
  loading: boolean
  error: Error | null
  accent: string
}) {
  const outlinePath = useMemo(() => buildOutlinePath(outline?.points ?? []), [outline])
  const identity = circuitIdentity(meeting)

  let body: ReactNode
  if (loading) {
    body = <div className="preview-section-state">Loading…</div>
  } else if (error) {
    body = (
      <div className="preview-section-state error">
        {error instanceof Error ? error.message : 'Failed to load'}
      </div>
    )
  } else if (outlinePath) {
    body = (
      <div className="preview-track-stage" style={{ ['--preview-accent' as string]: accent }}>
        <svg className="preview-track-svg" viewBox="0 0 100 100" role="img" aria-label="Circuit outline">
          <path className="preview-track-shadow" d={outlinePath} />
          <path className="preview-track-outline" d={outlinePath} />
        </svg>
      </div>
    )
  } else {
    body = (
      <div className="preview-track-fallback" data-testid="preview-track-fallback">
        <div className="preview-track-fallback-glyph" aria-hidden />
        <p className="preview-track-fallback-name">{identity.name}</p>
        {identity.place && <p className="preview-track-fallback-place">{identity.place}</p>}
        <p className="preview-track-fallback-hint">
          A GPS track outline is not available in the local cache.
        </p>
      </div>
    )
  }

  return (
    <section className="preview-card" data-testid="preview-track-card">
      <h2 className="preview-card-title">Circuit</h2>
      {body}
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
  error: Error | null
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
  error: Error | null
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

export function RacePreviewPage() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const nowDate = useMemo(() => new Date(now), [now])

  const seasonsQuery = useQuery({
    queryKey: ['seasons'],
    queryFn: fetchSeasons,
  })

  const latestSeason = seasonsQuery.data?.[0] ?? null

  const meetingsQuery = useQuery({
    queryKey: ['meetings', latestSeason, 'auto'],
    queryFn: () => fetchMeetings(latestSeason!, 'auto'),
    enabled: latestSeason != null,
  })

  const previewMeeting = useMemo(
    () => pickPreviewMeeting(meetingsQuery.data ?? [], nowDate),
    [meetingsQuery.data, nowDate],
  )

  const sessionsQuery = useQuery({
    queryKey: ['sessions', previewMeeting?.meeting_key, 'auto'],
    queryFn: () => fetchSessions(previewMeeting!.meeting_key, 'auto'),
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
    queryFn: () => fetchMeetings(priorYear!, 'auto'),
    enabled: priorYear != null && previewMeeting != null,
  })

  const priorMeeting = useMemo(
    () => findPriorYearMeetingByCircuit(priorMeetingsQuery.data ?? [], previewMeeting?.circuit_key),
    [priorMeetingsQuery.data, previewMeeting?.circuit_key],
  )

  const priorSessionsQuery = useQuery({
    queryKey: ['sessions', priorMeeting?.meeting_key, 'auto'],
    queryFn: () => fetchSessions(priorMeeting!.meeting_key, 'auto'),
    enabled: priorMeeting != null,
  })

  const priorRaceSession = useMemo(
    () => findRaceSession(priorSessionsQuery.data ?? []),
    [priorSessionsQuery.data],
  )

  const priorResultsQuery = useQuery({
    queryKey: ['results', priorRaceSession?.session_key, 'auto'],
    queryFn: () => fetchResults(priorRaceSession!.session_key, 'auto'),
    enabled: priorRaceSession != null,
  })

  const priorGridQuery = useQuery({
    queryKey: ['grid', priorRaceSession?.session_key, 'auto'],
    queryFn: () => fetchStartingGrid(priorRaceSession!.session_key, 'auto'),
    enabled: priorRaceSession != null,
  })

  const trackOutlineQuery = useQuery({
    queryKey: ['track-outline', previewMeeting?.circuit_key, previewMeeting?.year],
    queryFn: () => fetchTrackOutline(previewMeeting!.circuit_key!, previewMeeting!.year),
    enabled: previewMeeting?.circuit_key != null && previewMeeting.circuit_key > 0,
  })

  const championshipQuery = useQuery({
    queryKey: ['championship-hub', latestSeason],
    queryFn: () => fetchChampionshipHub(latestSeason!),
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

  if (seasonsQuery.isLoading || meetingsQuery.isLoading) {
    return <div className="page loading-state" data-testid="preview-loading">loading preview…</div>
  }

  if (seasonsQuery.isError || meetingsQuery.isError) {
    const err = seasonsQuery.error ?? meetingsQuery.error
    return (
      <div className="page error-box" data-testid="preview-error">
        {err instanceof Error ? err.message : 'Failed to load preview'}
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
            error={championshipQuery.isError ? (championshipQuery.error as Error) : null}
            drivers={titleFight}
            sprintWeekend={false}
            season={latestSeason}
          />
        )}
      </div>
    )
  }

  return (
    <div className="preview-page" data-testid="preview-page">
      <PreviewHeader
        meeting={previewMeeting}
        sessions={sessions}
        countdownSession={countdownSession}
        now={nowDate}
        accent={accent}
      />

      <div className="preview-grid">
        <TrackOutlineCard
          meeting={previewMeeting}
          outline={trackOutlineQuery.data}
          loading={trackOutlineQuery.isLoading}
          error={trackOutlineQuery.isError ? (trackOutlineQuery.error as Error) : null}
          accent={accent}
        />

        <LastYearCard
          year={priorMeeting?.year ?? priorYear}
          loading={priorMeetingsQuery.isLoading || priorSessionsQuery.isLoading || priorResultsQuery.isLoading}
          error={
            priorMeetingsQuery.isError
              ? (priorMeetingsQuery.error as Error)
              : priorResultsQuery.isError
                ? (priorResultsQuery.error as Error)
                : null
          }
          podium={podium}
          pole={pole}
          isFirstTime={isFirstTimeCircuit}
        />
      </div>

      <TitleFightCard
        loading={championshipQuery.isLoading}
        error={championshipQuery.isError ? (championshipQuery.error as Error) : null}
        drivers={titleFight}
        sprintWeekend={sprintWeekend}
        season={latestSeason}
      />
    </div>
  )
}
