import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  fetchLocalMeetings,
  fetchRaceHub,
  fetchSeasons,
  fetchWeekend,
} from '../api'
import { DatasetStrip } from '../components/DatasetStrip'
import { RaceStoryCanvas } from '../components/RaceStoryCanvas'
import { TabBar, type Tab } from '../components/TabBar'
import { DatasetStatusView } from '../components/DatasetStatusView'
import { StrategyView } from '../components/StrategyView'
import { LapsView } from '../components/LapsView'
import { RaceControlView } from '../components/RaceControlView'
import { WeatherView } from '../components/WeatherView'
import { OverviewView } from '../components/OverviewView'
import { WeekendSwitcher } from '../components/WeekendSwitcher'
import { SourceBadge } from '../components/SourceBadge'
import { countryAccent, countryDecal, formatGpDateRange } from '../lib/gpIdentity'
import { formatCoverageHint, sessionTypeAbbrev } from '../lib/coverage'
import {
  formatSessionScheduleTime,
  pickFocusMeeting,
  sortSessionsByStart,
} from '../lib/schedule'
import type { Weekend, WeekendSession } from '../types'

interface Props {
  sessionKey: number
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

export function RaceHubPage({ sessionKey }: Props) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [switcherOpen, setSwitcherOpen] = useState(false)

  // ─── Auto-redirect when no session_key is supplied ───
  const seasonsQuery = useQuery({
    queryKey: ['seasons'],
    queryFn: fetchSeasons,
    enabled: sessionKey === 0,
  })

  const latestSeason = seasonsQuery.data?.[0] ?? null

  const meetingsQuery = useQuery({
    queryKey: ['meetings', latestSeason],
    queryFn: () => fetchLocalMeetings(latestSeason!),
    enabled: sessionKey === 0 && latestSeason != null,
  })

  const focusMeeting = useMemo(() => {
    if (sessionKey !== 0 || !meetingsQuery.data) return null
    return pickFocusMeeting(meetingsQuery.data, new Date())
  }, [sessionKey, meetingsQuery.data])

  const fallbackWeekendQuery = useQuery({
    queryKey: ['weekend', focusMeeting?.meeting_key],
    queryFn: () => fetchWeekend(focusMeeting!.meeting_key),
    enabled: sessionKey === 0 && focusMeeting != null,
  })

  useEffect(() => {
    if (sessionKey !== 0) return
    const weekend = fallbackWeekendQuery.data
    if (!weekend) return
    const target = pickAnalysisSession(weekend)?.session.session_key
      ?? weekend.default_session_key
      ?? weekend.sessions[0]?.session.session_key
    if (target) {
      navigate({ to: '/race-hub', search: { session_key: target }, replace: true })
    }
  }, [sessionKey, fallbackWeekendQuery.data, navigate])

  // ─── Active session payload ───
  const raceHubQuery = useQuery({
    queryKey: ['race-hub', sessionKey],
    queryFn: () => fetchRaceHub(sessionKey),
    enabled: sessionKey > 0,
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

  // ─── No session_key: show resolving state, fall back to switcher if no local data ───
  if (sessionKey === 0) {
    if (seasonsQuery.isLoading || meetingsQuery.isLoading || fallbackWeekendQuery.isLoading) {
      return (
        <div className="rh-page" style={accentStyle}>
          <div className="loading-state">resolving latest local weekend…</div>
        </div>
      )
    }
    const seasons = seasonsQuery.data ?? []
    if (seasons.length === 0) {
      return (
        <div className="rh-page rh-empty" data-testid="race-hub-empty" style={accentStyle}>
          <div className="rh-empty-band">
            <span className="rh-empty-eyebrow mono">box-box · race hub</span>
            <h1 className="rh-empty-title">No local sessions yet</h1>
            <p className="rh-empty-sub">
              The Race Hub reads from local ingest only. Once a weekend is ingested
              it will open here automatically.
            </p>
            <div className="rh-empty-actions">
              <a href="/admin" className="rh-empty-action">Open Admin · Data Health</a>
              <a href="/" className="rh-empty-action">Back to Command Center</a>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="rh-page" style={accentStyle}>
        <div className="loading-state">resolving latest local weekend…</div>
      </div>
    )
  }

  // ─── Loading / error for the requested session_key ───
  if (raceHubQuery.isLoading) {
    return (
      <div className="rh-page" style={accentStyle}>
        <div className="loading-state">loading session {sessionKey}…</div>
      </div>
    )
  }
  if (raceHubQuery.isError || !data) {
    return (
      <div className="rh-page" style={accentStyle}>
        <div className="error-box">
          {raceHubQuery.error instanceof Error
            ? raceHubQuery.error.message
            : `Failed to load session ${sessionKey}.`}
        </div>
      </div>
    )
  }

  const decal = countryDecal(data.meeting ?? null)
  const sessions = weekend ? sortSessionsByStart(weekend.sessions.map((w) => w.session)) : []
  const sessionMeta = weekend
    ? Object.fromEntries(weekend.sessions.map((w) => [w.session.session_key, w]))
    : {}
  const activeSessionMeta = sessionMeta[sessionKey]

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
          currentSessionKey={sessionKey}
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
            const active = session.session_key === sessionKey
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
          <span className="rh-active-key mono">key {sessionKey}</span>
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

      {activeTab === 'lap_data' && (
        <div className="data-section">
          <div className="sec-header">
            <span className="sec-title">Lap Data</span>
            {data.laps.length > 0 && (
              <span className="sec-meta mono">{data.laps.length} samples</span>
            )}
          </div>
          <LapsView laps={data.laps} />
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
