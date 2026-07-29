import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { fetchRaceHub, fetchWeekend, fetchWeekendContext } from '../api'
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
import { WeekendSwitcher } from '../components/WeekendSwitcher'
import { SourceBadge } from '../components/SourceBadge'
import { countryAccent, countryDecal, formatGpDateRange } from '../lib/gpIdentity'
import { formatCoverageHint, sessionTypeAbbrev } from '../lib/coverage'
import {
  MAX_BROWSER_TIMEOUT,
  formatCountdown,
  formatSessionScheduleTime,
  refreshDeadlineDelay,
  sortSessionsByStart,
} from '../lib/schedule'
import type { ContextSession, Weekend } from '../types'

interface Props {
  sessionKey: number
}

export function RaceHubPage({ sessionKey }: Props) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [refreshGeneration, setRefreshGeneration] = useState(0)

  // The server owns bare Race Hub selection so every open tab crosses the
  // one-hour handoff at the same instant.
  const contextQuery = useQuery({
    queryKey: ['weekend-context'],
    queryFn: fetchWeekendContext,
    enabled: sessionKey === 0,
  })
  const { refetch: refetchContext } = contextQuery

  const context = contextQuery.data
  const preSession = sessionKey === 0 && context?.race_hub_pre_session === true
  const preSessionRef = context?.race_hub_default_session
  const preSessionMeetingKey = preSessionRef?.meeting?.meeting_key
  const preSessionWeekendQuery = useQuery({
    queryKey: ['weekend', preSessionMeetingKey],
    queryFn: () => fetchWeekend(preSessionMeetingKey!),
    enabled: preSession && preSessionMeetingKey != null && preSessionMeetingKey > 0,
  })

  useEffect(() => {
    if (sessionKey !== 0) return
    const delay = refreshDeadlineDelay(context?.race_hub_refresh_at)
    if (delay == null) return
    const rearmAfterRefetch = delay === MAX_BROWSER_TIMEOUT
    const timer = window.setTimeout(() => {
      void refetchContext().finally(() => {
        if (rearmAfterRefetch) setRefreshGeneration((generation) => generation + 1)
      })
    }, delay)
    return () => window.clearTimeout(timer)
  }, [sessionKey, context?.race_hub_refresh_at, refetchContext, refreshGeneration])

  useEffect(() => {
    if (!preSession) return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [preSession])

  // A bare route retains canonical context ownership while rendering its
  // completed analysis selection. Explicit URLs remain user-owned.
  const selectedSessionKey = sessionKey || context?.race_hub_default_session?.session.session_key || 0

  // ─── Active session payload ───
  const raceHubQuery = useQuery({
    queryKey: ['race-hub', selectedSessionKey],
    queryFn: () => fetchRaceHub(selectedSessionKey),
    enabled: selectedSessionKey > 0 && (sessionKey > 0 || !preSession),
    staleTime: 30_000,
  })

  const meetingKey = raceHubQuery.data?.meeting?.meeting_key
  const weekendQuery = useQuery({
    queryKey: ['weekend', meetingKey],
    queryFn: () => fetchWeekend(meetingKey!),
    enabled: meetingKey != null && meetingKey > 0,
    staleTime: 60_000,
  })

  const data = raceHubQuery.data
  const weekend = weekendQuery.data
  const accent = countryAccent(data?.meeting ?? null)
  const accentStyle = { '--gp-accent': accent } as React.CSSProperties

  // ─── No session_key: resolve exclusively through canonical Weekend Context ───
  if (sessionKey === 0) {
    if (contextQuery.isLoading || (preSession && preSessionWeekendQuery.isLoading)) {
      return (
        <div className="rh-page" style={accentStyle}>
          <div className="loading-state">resolving latest local weekend…</div>
        </div>
      )
    }
    if (preSession && preSessionRef) {
      return (
        <RaceHubPreSession
          session={preSessionRef}
          weekend={preSessionWeekendQuery.data}
          now={now}
          switcherOpen={switcherOpen}
          onToggleSwitcher={() => setSwitcherOpen((open) => !open)}
          onCloseSwitcher={() => setSwitcherOpen(false)}
        />
      )
    }
    if (!selectedSessionKey) {
      return (
        <div className="rh-page rh-empty" data-testid="race-hub-empty" style={accentStyle}>
          <div className="rh-empty-band">
            <span className="rh-empty-eyebrow mono">box-box · race hub</span>
            <h1 className="rh-empty-title">No completed local analysis yet</h1>
            <p className="rh-empty-sub">
              Race Hub opens completed local analysis between weekends. Check Data Health
              to ingest a completed session.
            </p>
            <div className="rh-empty-actions">
              <a href="/admin" className="rh-empty-action">Open Admin · Data Health</a>
              <a href="/" className="rh-empty-action">Back to Command Center</a>
            </div>
          </div>
        </div>
      )
    }
  }

  // ─── Loading / error for the selected session ───
  if (raceHubQuery.isLoading) {
    return (
      <div className="rh-page" style={accentStyle}>
        <div className="loading-state">loading session {selectedSessionKey}…</div>
      </div>
    )
  }
  if (raceHubQuery.isError || !data) {
    return (
      <div className="rh-page" style={accentStyle}>
        <div className="error-box">
          {raceHubQuery.error instanceof Error
            ? raceHubQuery.error.message
            : `Failed to load session ${selectedSessionKey}.`}
        </div>
      </div>
    )
  }

  const decal = countryDecal(data.meeting ?? null)
  const sessions = weekend ? sortSessionsByStart(weekend.sessions.map((w) => w.session)) : []
  const sessionMeta = weekend
    ? Object.fromEntries(weekend.sessions.map((w) => [w.session.session_key, w]))
    : {}
  const activeSessionMeta = sessionMeta[selectedSessionKey]

  return (
    <div className="rh-page" data-testid="race-hub" style={accentStyle}>
      {/* Topbar */}
      <div className="rh-topbar">
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
          currentSessionKey={selectedSessionKey}
          onClose={() => setSwitcherOpen(false)}
        />
      )}

      {/* GP Identity band */}
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

      {/* Session rail */}
      {sessions.length > 0 && (
        <nav className="rh-session-rail" aria-label="Weekend sessions" data-testid="rh-session-rail">
          {sessions.map((session) => {
            const meta = sessionMeta[session.session_key]
            const active = session.session_key === selectedSessionKey
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
                {meta && (
                  <span className="rh-session-cov mono">
                    <span
                      className={`cc-cov-dot cc-cov-${meta.source}`}
                      aria-hidden="true"
                    />
                    {formatCoverageHint(meta.datasets)}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      )}

      {/* Active session sub-bar */}
      {data.session && (
        <div className="rh-active-bar" data-testid="rh-active-bar">
          <span className="rh-active-name">{data.session.session_name}</span>
          <span className="rh-active-meta mono">
            {formatSessionScheduleTime(data.session.date_start)}
          </span>
          {activeSessionMeta && (
            <span className="rh-active-cov mono">
              <span
                className={`cc-cov-dot cc-cov-${activeSessionMeta.source}`}
                aria-hidden="true"
              />
              {formatCoverageHint(activeSessionMeta.datasets)} datasets local
            </span>
          )}
          <span className="rh-active-key mono">key {selectedSessionKey}</span>
        </div>
      )}

      <DatasetStrip datasets={data.datasets} />

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
            sessionKey={selectedSessionKey}
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
            <span className="sec-title">Data Status</span>
          </div>
          <DatasetStatusView datasets={data.datasets} />
        </div>
      )}
    </div>
  )
}

function RaceHubPreSession({
  session,
  weekend,
  now,
  switcherOpen,
  onToggleSwitcher,
  onCloseSwitcher,
}: {
  session: ContextSession
  weekend?: Weekend
  now: number
  switcherOpen: boolean
  onToggleSwitcher: () => void
  onCloseSwitcher: () => void
}) {
  const meeting = session.meeting
  const sessions = sortSessionsByStart((weekend?.sessions ?? []).map((entry) => entry.session))
  const target = new Date(session.session.date_start)
  const accent = countryAccent(meeting ?? null)
  const pendingLiveEvidence = target.getTime() <= now

  return (
    <div className="rh-page rh-empty" data-testid="race-hub-pre-session" style={{ '--gp-accent': accent } as React.CSSProperties}>
      <div className="rh-topbar">
        <span className="rh-topbar-label mono">box-box · race hub</span>
        <span className="rh-topbar-spacer" />
        <button
          type="button"
          className={`rh-switcher-toggle${switcherOpen ? ' active' : ''}`}
          onClick={onToggleSwitcher}
          aria-expanded={switcherOpen}
          aria-controls="rh-weekend-switcher"
          data-testid="rh-switch-weekend"
        >
          {switcherOpen ? 'Close' : 'Switch Weekend'}
        </button>
      </div>

      {switcherOpen && (
        <WeekendSwitcher
          currentMeetingKey={meeting?.meeting_key}
          currentSessionKey={session.session.session_key}
          onClose={onCloseSwitcher}
        />
      )}

      <section className="rh-empty-band">
        <span className="rh-empty-eyebrow mono">box-box · race hub</span>
        <h1 className="rh-empty-title">{meeting?.meeting_name ?? 'Next race weekend'}</h1>
        <p className="rh-empty-sub">
          {pendingLiveEvidence
            ? `${session.session.session_name} is scheduled; awaiting live timing.`
            : <>{session.session.session_name} begins in <span className="mono">{formatCountdown(target, new Date(now))}</span></>}
        </p>
        {sessions.length > 0 && (
          <div className="preview-schedule" data-testid="rh-pre-session-schedule">
            {sessions.map((scheduled) => (
              <div key={scheduled.session_key} className="preview-schedule-item">
                <span className="preview-schedule-name">{scheduled.session_name}</span>
                <span className="preview-schedule-time">{formatSessionScheduleTime(scheduled.date_start)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
