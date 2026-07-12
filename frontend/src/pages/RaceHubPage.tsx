import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { fetchRaceHub, fetchWeekend, fetchWeekendContext } from '../api'
import { weekendFocusSearch } from '../lib/routeSearch'
import { DatasetStrip } from '../components/DatasetStrip'
import { RaceStoryCanvas } from '../components/RaceStoryCanvas'
import { TabBar, type Tab } from '../components/TabBar'
import { DatasetStatusView } from '../components/DatasetStatusView'
import { StrategyView } from '../components/StrategyView'
import { LapsView } from '../components/LapsView'
import { CompareView } from '../components/CompareView'
import { RaceControlView } from '../components/RaceControlView'
import { WeatherView } from '../components/WeatherView'
import { OverviewView } from '../components/OverviewView'
import {
  PartialAnalysisBanner,
  PreSessionView,
  SessionPhaseView,
} from '../components/PreSessionView'
import { WeekendSwitcher } from '../components/WeekendSwitcher'
import { SourceBadge } from '../components/SourceBadge'
import { RouteState } from '../components/RouteState'
import { countryAccent, countryDecal, formatGpDateRange } from '../lib/gpIdentity'
import { sessionTypeAbbrev } from '../lib/coverage'
import { formatSessionScheduleTime, sortSessionsByStart } from '../lib/schedule'
import {
  defaultAnalysisSessionKey,
  isPartialAnalysis,
  isPreSession,
  isPreparing,
  isUnavailable,
  resolveSessionState,
  sessionStateDotClass,
  sessionStateLabel,
} from '../lib/sessionState'
import type { WeekendSession } from '../types'

interface Props {
  sessionKey: number
}

export function RaceHubPage({ sessionKey }: Props) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [phaseDiagnostics, setPhaseDiagnostics] = useState(false)
  const [now, setNow] = useState(() => new Date())

  // Keep schedule-adjacent UI (countdown) moving; Live/completion come from context.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const contextQuery = useQuery({
    queryKey: ['weekend-context'],
    queryFn: ({ signal }) => fetchWeekendContext(signal),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
  const context = contextQuery.data ?? null

  // Bare `/race-hub` resolves only through canonical Weekend Context.
  useEffect(() => {
    if (sessionKey !== 0) return
    if (!contextQuery.isSuccess || !context) return
    const target = defaultAnalysisSessionKey(context)
    if (target) {
      navigate({ to: '/race-hub', search: { session_key: target }, replace: true })
    }
  }, [sessionKey, contextQuery.isSuccess, context, navigate])

  const raceHubQuery = useQuery({
    queryKey: ['race-hub', sessionKey],
    queryFn: ({ signal }) => fetchRaceHub(sessionKey, signal),
    enabled: sessionKey > 0,
    staleTime: 30_000,
  })

  const meetingKey = raceHubQuery.data?.meeting?.meeting_key
  const weekendQuery = useQuery({
    queryKey: ['weekend', meetingKey],
    queryFn: ({ signal }) => fetchWeekend(meetingKey!, signal),
    enabled: meetingKey != null && meetingKey > 0,
    staleTime: 60_000,
  })

  const data = raceHubQuery.data
  const weekend = weekendQuery.data
  const accent = countryAccent(data?.meeting ?? null)
  const accentStyle = { '--gp-accent': accent } as React.CSSProperties

  const openDiagnostics = () => {
    setActiveTab('data_status')
    setShowDiagnostics(true)
    setPhaseDiagnostics(true)
  }

  // ─── No session_key: resolve via Weekend Context ───
  if (sessionKey === 0) {
    if (contextQuery.isLoading) {
      return (
        <div className="rh-page" style={accentStyle}>
          <RouteState
            kind="loading"
            title="resolving weekend context…"
            testId="race-hub-loading"
          />
        </div>
      )
    }
    if (contextQuery.isError) {
      return (
        <div className="rh-page" data-testid="race-hub-error" style={accentStyle}>
          <RouteState
            kind="error"
            title="Weekend unavailable"
            error={contextQuery.error}
            onRetry={() => {
              if (!contextQuery.isFetching) void contextQuery.refetch()
            }}
            retrying={contextQuery.isFetching}
            retryTestId="rh-retry"
          >
            <div className="rh-recover-actions">
              <Link to="/" search={{}} className="rh-recover-btn" data-testid="rh-back-weekend">
                Back to Weekend
              </Link>
            </div>
          </RouteState>
        </div>
      )
    }

    if (context && !defaultAnalysisSessionKey(context)) {
      return (
        <div className="rh-page rh-empty" data-testid="race-hub-no-analysis" style={accentStyle}>
          <div className="rh-empty-band">
            <span className="rh-empty-eyebrow mono">box-box · race hub</span>
            <h1 className="rh-empty-title">No completed session to analyse yet</h1>
            <p className="rh-empty-sub">
              Weekend Context has no default analysis session. Pick a past session
              to review, or check back once a session completes with local analysis.
            </p>
            <div className="rh-empty-actions">
              <button
                type="button"
                className="rh-empty-action"
                onClick={() => setSwitcherOpen(true)}
              >
                Browse Weekends
              </button>
              <Link to="/" search={{}} className="rh-empty-action" data-testid="rh-back-weekend">
                Back to Weekend
              </Link>
            </div>
          </div>
          {switcherOpen && (
            <WeekendSwitcher
              currentMeetingKey={context.focus_meeting?.meeting_key}
              context={context}
              now={now}
              onClose={() => setSwitcherOpen(false)}
            />
          )}
        </div>
      )
    }

    return (
      <div className="rh-page" style={accentStyle}>
        <RouteState
          kind="loading"
          title="resolving weekend context…"
          testId="race-hub-loading"
        />
      </div>
    )
  }

  // ─── Loading / error for the requested session_key ───
  if (raceHubQuery.isLoading) {
    return (
      <div className="rh-page" style={accentStyle}>
        <RouteState
          kind="loading"
          title={`loading session ${sessionKey}…`}
          testId="race-hub-loading"
        />
      </div>
    )
  }
  if (raceHubQuery.isError || !data) {
    const backMeeting =
      context?.focus_meeting?.meeting_key ??
      context?.previous_completed_session?.meeting?.meeting_key
    const backSearch = weekendFocusSearch(backMeeting, sessionKey)

    return (
      <div className="rh-page" data-testid="race-hub-error" style={accentStyle}>
        <RouteState
          kind="error"
          title="Session unavailable"
          error={raceHubQuery.error}
          message={
            raceHubQuery.error
              ? undefined
              : `Session ${sessionKey} could not be loaded from local data.`
          }
          onRetry={() => {
            if (!raceHubQuery.isFetching) void raceHubQuery.refetch()
          }}
          retrying={raceHubQuery.isFetching}
          retryTestId="rh-retry"
        >
          <div className="rh-recover-actions">
            <Link
              to="/"
              search={backSearch}
              className="rh-recover-btn"
              data-testid="rh-back-weekend"
              data-meeting-key={backMeeting ?? undefined}
              data-session-key={sessionKey}
            >
              Back to Weekend
            </Link>
          </div>
        </RouteState>
      </div>
    )
  }

  const decal = countryDecal(data.meeting ?? null)
  const sessions = weekend ? sortSessionsByStart(weekend.sessions.map((w) => w.session)) : []
  const sessionMeta = weekend
    ? Object.fromEntries(weekend.sessions.map((w) => [w.session.session_key, w]))
    : {}
  const activeSessionMeta: WeekendSession | undefined = sessionMeta[sessionKey]
  const activeState = resolveSessionState({
    weekendSession: activeSessionMeta,
    context,
    now,
  })
  const preSession = isPreSession(activeState)
  const preparing = isPreparing(activeState)
  const unavailable = isUnavailable(activeState)
  const partial = isPartialAnalysis(activeState)

  return (
    <div className="rh-page" data-testid="race-hub" style={accentStyle}>
      <div className="rh-topbar">
        <Link
          to="/"
          search={weekendFocusSearch(meetingKey, sessionKey)}
          className="rh-back-weekend"
          data-testid="rh-back-weekend"
          data-meeting-key={meetingKey ?? undefined}
          data-session-key={sessionKey}
        >
          Back to Weekend
        </Link>
        <span className="rh-topbar-label mono">
          box-box · race hub
          {data.meeting?.year ? ` · ${data.meeting.year}` : ''}
        </span>
        <span className="rh-topbar-spacer" />
        <SourceBadge source={data.source} />
        <button
          type="button"
          className={`rh-switcher-toggle${switcherOpen ? ' active' : ''}`}
          onClick={() => setSwitcherOpen((v) => !v)}
          aria-expanded={switcherOpen}
          data-testid="rh-switch-weekend"
        >
          {switcherOpen ? 'Close' : 'Switch Weekend'}
        </button>
      </div>

      {switcherOpen && (
        <WeekendSwitcher
          currentMeetingKey={meetingKey}
          currentSessionKey={sessionKey}
          context={context}
          now={now}
          onClose={() => setSwitcherOpen(false)}
        />
      )}

      {data.meeting && (
        <section className="rh-identity" data-testid="rh-identity">
          <div className="rh-identity-accent" aria-hidden="true" />
          <div className="rh-identity-body">
            <span className="rh-identity-decal mono">{decal}</span>
            <div className="rh-identity-titles">
              <h1 className="rh-identity-name">{data.meeting.meeting_name}</h1>
              <div className="rh-identity-sub mono">
                {[data.meeting.location, data.meeting.circuit_short_name]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <div className="rh-identity-sub mono rh-identity-dates">
                {formatGpDateRange(data.meeting)}
              </div>
            </div>
          </div>
        </section>
      )}

      {sessions.length > 0 && (
        <nav className="rh-session-rail" aria-label="Weekend sessions" data-testid="rh-session-rail">
          {sessions.map((session) => {
            const meta = sessionMeta[session.session_key]
            const active = session.session_key === sessionKey
            const state = resolveSessionState({
              weekendSession: meta,
              context,
              now,
            })
            return (
              <button
                key={session.session_key}
                type="button"
                className={`rh-session-chip${active ? ' active' : ''}`}
                onClick={() =>
                  navigate({
                    to: '/race-hub',
                    search: { session_key: session.session_key },
                  })
                }
                aria-current={active ? 'page' : undefined}
                data-testid={`rh-session-${session.session_key}`}
              >
                <span className="rh-session-abbrev mono">
                  {sessionTypeAbbrev(session.session_type, session.session_name)}
                </span>
                <span className="rh-session-name">{session.session_name}</span>
                <span className="rh-session-time mono">
                  {formatSessionScheduleTime(session.date_start)}
                </span>
                <span className="rh-session-cov mono">
                  <span
                    className={`cc-cov-dot ${sessionStateDotClass(state)}`}
                    aria-hidden="true"
                  />
                  {sessionStateLabel(state)}
                </span>
              </button>
            )
          })}
        </nav>
      )}

      {data.session && (
        <div className="rh-active-bar" data-testid="rh-active-bar">
          <span className="rh-active-name">{data.session.session_name}</span>
          <span className="rh-active-meta mono">
            {formatSessionScheduleTime(data.session.date_start)}
          </span>
          <span className="rh-active-cov mono" data-testid="rh-active-state">
            <span
              className={`cc-cov-dot ${sessionStateDotClass(activeState)}`}
              aria-hidden="true"
            />
            {sessionStateLabel(activeState)}
          </span>
          <span className="rh-active-key mono">key {sessionKey}</span>
        </div>
      )}

      {preSession && data.session ? (
        <PreSessionView
          session={data.session}
          sessionName={data.session.session_name}
          now={now}
        />
      ) : preparing || unavailable ? (
        <>
          <SessionPhaseView
            state={
              unavailable
                ? activeState === 'cancelled'
                  ? 'cancelled'
                  : 'unavailable'
                : 'preparing'
            }
            sessionName={data.session?.session_name ?? `Session ${sessionKey}`}
            onOpenDiagnostics={openDiagnostics}
          />
          {phaseDiagnostics && (
            <div className="data-section" data-testid="rh-phase-diagnostics">
              <div className="sec-header">
                <span className="sec-title">Diagnostics</span>
              </div>
              <DatasetStatusView datasets={data.datasets} />
              <div style={{ marginTop: 'var(--s5)' }} data-testid="rh-dataset-strip">
                <DatasetStrip datasets={data.datasets} />
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {partial && <PartialAnalysisBanner onOpenDiagnostics={openDiagnostics} />}
          <TabBar active={activeTab} onChange={setActiveTab} />

          {activeTab === 'overview' && <OverviewView data={data} />}

          {activeTab === 'race_story' && (
            <div className="data-section">
              <RaceStoryCanvas data={data} />
            </div>
          )}

          {activeTab === 'strategy' && (
            <div className="data-section">
              <div className="sec-header">
                <span className="sec-title">Race Strategy</span>
              </div>
              <StrategyView
                results={data.results}
                stints={data.stints}
                pit_stops={data.pit_stops}
                hasStints={data.datasets['stints']?.status === 'available'}
              />
            </div>
          )}

          {activeTab === 'compare' && (
            <div className="data-section">
              <div className="sec-header">
                <span className="sec-title">Driver Compare</span>
              </div>
              <CompareView
                sessionKey={sessionKey}
                results={data.results}
                drivers={data.drivers}
              />
            </div>
          )}

          {activeTab === 'lap_data' && (
            <div className="data-section">
              <div className="sec-header">
                <span className="sec-title">Lap Data</span>
                {data.laps.length > 0 && (
                  <span className="sec-meta mono">{data.laps.length} samples</span>
                )}
              </div>
              <LapsView laps={data.laps} drivers={data.drivers} />
            </div>
          )}

          {activeTab === 'conditions' && (
            <div className="data-section">
              <div className="sec-header">
                <span className="sec-title">Conditions</span>
                {data.weather.length > 0 && (
                  <span className="sec-meta mono">{data.weather.length} samples</span>
                )}
              </div>
              <WeatherView weather={data.weather} />
            </div>
          )}

          {activeTab === 'race_control' && (
            <div className="data-section">
              <div className="sec-header">
                <span className="sec-title">Race Control</span>
                {data.race_control.length > 0 && (
                  <span className="sec-meta mono">{data.race_control.length} messages</span>
                )}
              </div>
              <RaceControlView messages={data.race_control} />
            </div>
          )}

          {activeTab === 'data_status' && (
            <div className="data-section">
              <div className="sec-header">
                <span className="sec-title">Diagnostics</span>
                <button
                  type="button"
                  className={`rh-diagnostics-toggle${showDiagnostics ? ' active' : ''}`}
                  onClick={() => setShowDiagnostics((v) => !v)}
                  aria-expanded={showDiagnostics}
                  data-testid="rh-diagnostics-toggle"
                >
                  {showDiagnostics ? 'Hide dataset coverage' : 'Show dataset coverage'}
                </button>
              </div>
              <DatasetStatusView datasets={data.datasets} />
              {showDiagnostics && (
                <div style={{ marginTop: 'var(--s5)' }} data-testid="rh-dataset-strip">
                  <DatasetStrip datasets={data.datasets} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
