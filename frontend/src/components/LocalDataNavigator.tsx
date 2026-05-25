import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { fetchLocalMeetings, fetchSeasons, fetchWeekend } from '../api'
import type { DatasetInfo, Meeting, WeekendSession } from '../types'

const RACE_HUB_DATASETS = [
  'meeting',
  'session',
  'drivers',
  'results',
  'starting_grid',
  'stints',
  'pit_stops',
  'positions',
  'race_control',
  'weather',
  'laps',
] as const

export function countRaceHubDatasets(datasets: Record<string, DatasetInfo>): { available: number; total: number } {
  const total = RACE_HUB_DATASETS.length
  const available = RACE_HUB_DATASETS.filter((key) => datasets[key]?.status === 'available').length
  return { available, total }
}

export function formatCoverageHint(datasets: Record<string, DatasetInfo>): string {
  const { available, total } = countRaceHubDatasets(datasets)
  return `${available}/${total}`
}

function sourceBadge(source: WeekendSession['source']) {
  switch (source) {
    case 'local':
      return <span className="badge badge-local">Local</span>
    case 'partial':
      return <span className="badge badge-partial">Partial</span>
    default:
      return <span className="badge badge-none">None</span>
  }
}

function formatMeetingDates(meeting: Meeting): string {
  const start = meeting.date_start?.slice(0, 10)
  const end = meeting.date_end?.slice(0, 10)
  if (start && end && start !== end) return `${start} – ${end}`
  return start || end || '—'
}

interface Props {
  onSelectSession?: (sessionKey: number) => void
}

export function LocalDataNavigator({ onSelectSession }: Props) {
  const navigate = useNavigate()
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedMeetingKey, setSelectedMeetingKey] = useState<number | null>(null)

  const seasonsQuery = useQuery({
    queryKey: ['seasons'],
    queryFn: fetchSeasons,
  })

  const meetingsQuery = useQuery({
    queryKey: ['meetings', selectedYear],
    queryFn: () => fetchLocalMeetings(selectedYear!),
    enabled: selectedYear != null,
  })

  const weekendQuery = useQuery({
    queryKey: ['weekend', selectedMeetingKey],
    queryFn: () => fetchWeekend(selectedMeetingKey!),
    enabled: selectedMeetingKey != null,
  })

  useEffect(() => {
    if (seasonsQuery.data?.length && selectedYear == null) {
      setSelectedYear(seasonsQuery.data[0])
    }
  }, [seasonsQuery.data, selectedYear])

  function handleSelectSession(sessionKey: number) {
    if (onSelectSession) {
      onSelectSession(sessionKey)
      return
    }
    navigate({ to: '/race-hub', search: { session_key: sessionKey } })
  }

  function handleSelectYear(year: number) {
    setSelectedYear(year)
    setSelectedMeetingKey(null)
  }

  function handleSelectMeeting(meetingKey: number) {
    setSelectedMeetingKey((prev) => (prev === meetingKey ? null : meetingKey))
  }

  if (seasonsQuery.isLoading) {
    return <div className="nav-panel loading-state">loading local seasons…</div>
  }

  if (seasonsQuery.isError) {
    return (
      <div className="nav-panel error-box">
        {seasonsQuery.error instanceof Error ? seasonsQuery.error.message : 'Failed to load seasons'}
      </div>
    )
  }

  const seasons = seasonsQuery.data ?? []

  if (seasons.length === 0) {
    return (
      <div className="nav-panel" data-testid="local-nav-empty">
        <div className="nav-panel-title">Local Data</div>
        <div className="empty-state" style={{ padding: 'var(--s5) 0' }}>
          <div className="empty-state-title">No ingested seasons yet</div>
          <div className="empty-state-desc">
            Ingest a session with <code>box-box --ingest-session &lt;key&gt;</code>, then browse
            here or enter a session key below.
          </div>
        </div>
      </div>
    )
  }

  const meetings = meetingsQuery.data ?? []
  const weekend = weekendQuery.data

  return (
    <div className="nav-panel" data-testid="local-nav">
      <div className="nav-panel-head">
        <span className="nav-panel-title">Local Data</span>
        <div className="year-list" role="listbox" aria-label="Season">
          {seasons.map((year) => (
            <button
              key={year}
              type="button"
              role="option"
              aria-selected={year === selectedYear}
              className={`year-btn ${year === selectedYear ? 'active' : ''}`}
              onClick={() => handleSelectYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {meetingsQuery.isLoading && (
        <div className="nav-section-meta">loading meetings…</div>
      )}

      {meetingsQuery.isError && (
        <div className="error-box" style={{ marginTop: 'var(--s4)' }}>
          {meetingsQuery.error instanceof Error ? meetingsQuery.error.message : 'Failed to load meetings'}
        </div>
      )}

      {!meetingsQuery.isLoading && !meetingsQuery.isError && meetings.length === 0 && (
        <div className="nav-section-meta">No meetings ingested for {selectedYear}.</div>
      )}

      {meetings.length > 0 && (
        <div className="nav-section">
          <div className="sec-header">
            <span className="sec-title">Meetings</span>
            <span className="sec-meta">{meetings.length}</span>
          </div>
          <div className="scroll-x">
            <table className="data-table nav-table">
              <thead>
                <tr>
                  <th>Grand Prix</th>
                  <th className="hide-mobile">Country</th>
                  <th className="hide-mobile">Dates</th>
                  <th className="r">Open</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((meeting) => {
                  const selected = meeting.meeting_key === selectedMeetingKey
                  return (
                    <tr
                      key={meeting.meeting_key}
                      className={selected ? 'nav-row-selected' : ''}
                      data-testid={`meeting-row-${meeting.meeting_key}`}
                    >
                      <td>
                        <span style={{ fontWeight: 600 }}>{meeting.meeting_name}</span>
                        {meeting.circuit_short_name && meeting.circuit_short_name !== meeting.meeting_name && (
                          <span className="nav-sub">{meeting.circuit_short_name}</span>
                        )}
                      </td>
                      <td className="hide-mobile mono" style={{ color: 'var(--text-2)' }}>
                        {meeting.country_code || meeting.country_name}
                      </td>
                      <td className="hide-mobile mono" style={{ color: 'var(--text-3)' }}>
                        {formatMeetingDates(meeting)}
                      </td>
                      <td className="r">
                        <button
                          type="button"
                          className={`nav-action-btn ${selected ? 'active' : ''}`}
                          aria-expanded={selected}
                          onClick={() => handleSelectMeeting(meeting.meeting_key)}
                        >
                          {selected ? 'Hide' : 'Sessions'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedMeetingKey != null && weekendQuery.isLoading && (
        <div className="nav-section-meta">loading sessions…</div>
      )}

      {selectedMeetingKey != null && weekendQuery.isError && (
        <div className="error-box" style={{ marginTop: 'var(--s4)' }}>
          {weekendQuery.error instanceof Error ? weekendQuery.error.message : 'Failed to load weekend'}
        </div>
      )}

      {weekend && (
        <div className="nav-section" data-testid="weekend-sessions">
          <div className="sec-header">
            <span className="sec-title">{weekend.meeting.meeting_name} Sessions</span>
            <span className="sec-meta">{weekend.sessions.length}</span>
          </div>

          {weekend.sessions.length === 0 ? (
            <div className="nav-section-meta">No sessions stored for this meeting.</div>
          ) : (
            <div className="scroll-x">
              <table className="data-table nav-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th className="hide-mobile">Type</th>
                    <th>Coverage</th>
                    <th>Source</th>
                    <th className="r">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {weekend.sessions.map(({ session, source, datasets }) => {
                    const coverage = formatCoverageHint(datasets)
                    const isDefault = session.session_key === weekend.default_session_key
                    return (
                      <tr key={session.session_key} data-testid={`session-row-${session.session_key}`}>
                        <td>
                          <span style={{ fontWeight: 600 }}>{session.session_name}</span>
                          {isDefault && <span className="nav-sub">default</span>}
                          <span className="nav-sub mono">{session.session_key}</span>
                        </td>
                        <td className="hide-mobile mono" style={{ color: 'var(--text-3)' }}>
                          {session.session_type}
                        </td>
                        <td>
                          <span className="mono" style={{ color: 'var(--text-2)' }}>
                            {coverage}
                          </span>
                          <SessionCoverageDots datasets={datasets} />
                        </td>
                        <td>{sourceBadge(source)}</td>
                        <td className="r">
                          <button
                            type="button"
                            className="nav-action-btn nav-action-primary"
                            data-testid={`open-session-${session.session_key}`}
                            onClick={() => handleSelectSession(session.session_key)}
                          >
                            Race Hub
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SessionCoverageDots({ datasets }: { datasets: Record<string, DatasetInfo> }) {
  return (
    <span className="coverage-dots" aria-hidden="true">
      {RACE_HUB_DATASETS.map((key) => {
        const available = datasets[key]?.status === 'available'
        return <span key={key} className={`coverage-dot ${available ? 'on' : 'off'}`} />
      })}
    </span>
  )
}
