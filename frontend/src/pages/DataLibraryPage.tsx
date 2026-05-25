import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { fetchLocalMeetings, fetchSeasons, fetchWeekend } from '../api'
import {
  countWeekendStats,
  formatCoverageHint,
  sessionIconClass,
  sessionTypeAbbrev,
} from '../lib/coverage'
import { SourceBadge, weekendStatusLabel } from '../components/SourceBadge'
import { CliCommands, ingestYearCommands } from '../components/CliCommands'
import { MeetingDetailPanel } from '../components/MeetingDetailPanel'
import type { Meeting, Weekend } from '../types'

function formatMeetingDate(meeting: Meeting): string {
  const start = meeting.date_start?.slice(0, 10)
  if (!start) return '—'
  const d = new Date(start)
  if (Number.isNaN(d.getTime())) return start
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function DataLibraryPage() {
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

  const meetings = meetingsQuery.data ?? []

  const weekendQueries = useQueries({
    queries: meetings.map((meeting) => ({
      queryKey: ['weekend', meeting.meeting_key],
      queryFn: () => fetchWeekend(meeting.meeting_key),
      enabled: meetings.length > 0,
      staleTime: 60_000,
    })),
  })

  const weekendsByKey = useMemo(() => {
    const map = new Map<number, Weekend>()
    meetings.forEach((meeting, i) => {
      const data = weekendQueries[i]?.data
      if (data) map.set(meeting.meeting_key, data)
    })
    return map
  }, [meetings, weekendQueries])

  const stats = countWeekendStats(weekendQueries.map((q) => q.data))

  useEffect(() => {
    if (seasonsQuery.data?.length && selectedYear == null) {
      setSelectedYear(seasonsQuery.data[0])
    }
  }, [seasonsQuery.data, selectedYear])

  useEffect(() => {
    if (meetings.length === 0) {
      setSelectedMeetingKey(null)
      return
    }
    if (selectedMeetingKey == null || !meetings.some((m) => m.meeting_key === selectedMeetingKey)) {
      setSelectedMeetingKey(meetings[0].meeting_key)
    }
  }, [meetings, selectedMeetingKey])

  const selectedWeekend = selectedMeetingKey != null ? weekendsByKey.get(selectedMeetingKey) : undefined
  const weekendsLoading = weekendQueries.some((q) => q.isLoading)

  if (seasonsQuery.isLoading) {
    return <div className="page loading-state">loading local data library…</div>
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
      <div className="page" data-testid="data-library-empty">
        <div className="dl-page-header">
          <span className="dl-page-eyebrow mono">box-box · admin</span>
          <h1 className="dl-page-title">Data Health</h1>
          <span className="dl-page-sub mono">Local SQLite domain store · ingestion guidance</span>
        </div>
        <div className="empty-state">
          <div className="empty-state-title">No ingested seasons yet</div>
          <div className="empty-state-desc">
            Ingest a season or session from the CLI, then return here to inspect coverage.
          </div>
        </div>
        <div className="dl-cli-section">
          <div className="sec-header">
            <span className="sec-title">Get Started</span>
          </div>
          <CliCommands
            commands={[
              { comment: '# Discover season meetings and sessions', cmd: 'box-box --ingest-year 2025' },
              { comment: '# Then ingest a full weekend or single session', cmd: 'box-box --ingest-meeting <meeting_key>' },
            ]}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="dl-page" data-testid="data-library">
      <div className="dl-page-banner">
        <div className="dl-banner-titles">
          <span className="dl-page-eyebrow mono">box-box · admin</span>
          <h1 className="dl-page-title">Data Health</h1>
        </div>
        <div className="dl-banner-stats mono">
          <span>
            <em>{seasons.length}</em> season{seasons.length === 1 ? '' : 's'}
          </span>
          <span>
            <em className="dl-stat-full">{stats.full}</em> full
          </span>
          <span>
            <em className="dl-stat-partial">{stats.partial}</em> partial
          </span>
          <span>
            <em>{stats.missing}</em> missing
          </span>
        </div>
      </div>
      <div className="dl-layout">
        <aside className="dl-nav">
          <div>
            <div className="sec-header">
              <span className="sec-title">Seasons</span>
            </div>
            <div className="season-list" role="listbox" aria-label="Season">
              {seasons.map((year) => (
                <button
                  key={year}
                  type="button"
                  role="option"
                  aria-selected={year === selectedYear}
                  className={`season-row ${year === selectedYear ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedYear(year)
                    setSelectedMeetingKey(null)
                  }}
                >
                  <span>{year}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedYear != null && meetings.length > 0 && (
            <div className="dl-stats">
              <div className="dl-stat">
                <span className="dl-stat-label">Full</span>
                <span className="dl-stat-val dl-stat-full">{stats.full}</span>
              </div>
              <div className="dl-stat">
                <span className="dl-stat-label">Partial</span>
                <span className="dl-stat-val dl-stat-partial">{stats.partial}</span>
              </div>
              <div className="dl-stat">
                <span className="dl-stat-label">Missing</span>
                <span className="dl-stat-val">{stats.missing}</span>
              </div>
              <div className="dl-stat">
                <span className="dl-stat-label">Total</span>
                <span className="dl-stat-val">{stats.total}</span>
              </div>
            </div>
          )}

          {selectedYear != null && (
            <div className="dl-cli-section">
              <div className="sec-header">
                <span className="sec-title">Season Ingest</span>
              </div>
              <CliCommands commands={ingestYearCommands(selectedYear)} />
            </div>
          )}
        </aside>

        <div className="dl-content">
          <div className="dl-content-header">
            <span className="dl-content-title">{selectedYear} Season</span>
            {meetings.length > 0 && (
              <span className="dl-content-meta">
                {meetings.length} meeting{meetings.length === 1 ? '' : 's'}
                {!weekendsLoading && (
                  <>
                    {' '}
                    · {stats.full} complete · {stats.partial} partial
                  </>
                )}
              </span>
            )}
          </div>

          {meetingsQuery.isLoading && (
            <div className="loading-state">loading meetings…</div>
          )}

          {meetingsQuery.isError && (
            <div className="error-box">
              {meetingsQuery.error instanceof Error
                ? meetingsQuery.error.message
                : 'Failed to load meetings'}
            </div>
          )}

          {!meetingsQuery.isLoading && !meetingsQuery.isError && meetings.length === 0 && (
            <div className="missing-notice">
              No meetings discovered for {selectedYear}. Run{' '}
              <code>box-box --ingest-year {selectedYear}</code>
            </div>
          )}

          {meetings.length > 0 && (
            <div className="dl-content-body">
              <div className="dl-round-scroll">
                <table className="data-table rounds-table">
                  <thead>
                    <tr>
                      <th className="c" style={{ width: 36 }}>
                        #
                      </th>
                      <th>Weekend</th>
                      <th className="hide-mobile">Date</th>
                      <th>Status</th>
                      <th className="hide-mobile">Sessions</th>
                      <th className="hide-mobile">Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.map((meeting, index) => {
                      const weekend = weekendsByKey.get(meeting.meeting_key)
                      const selected = meeting.meeting_key === selectedMeetingKey
                      const source = weekend?.source ?? 'none'
                      return (
                        <tr
                          key={meeting.meeting_key}
                          className={selected ? 'dl-row-selected' : ''}
                          data-testid={`dl-meeting-${meeting.meeting_key}`}
                          onClick={() => setSelectedMeetingKey(meeting.meeting_key)}
                        >
                          <td className="c mono" style={{ color: 'var(--text-3)' }}>
                            {index + 1}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{meeting.meeting_name}</span>
                            <span className="nav-sub mono">key {meeting.meeting_key}</span>
                          </td>
                          <td className="hide-mobile mono" style={{ color: 'var(--text-3)' }}>
                            {formatMeetingDate(meeting)}
                          </td>
                          <td>
                            <SourceBadge source={source} label={weekendStatusLabel(source)} />
                          </td>
                          <td className="hide-mobile">
                            {weekend ? (
                              <div className="session-icons">
                                {weekend.sessions.map((entry) => (
                                  <span
                                    key={entry.session.session_key}
                                    className={`session-icon ${sessionIconClass(entry)}`}
                                    title={`${entry.session.session_name} (${formatCoverageHint(entry.datasets)})`}
                                  >
                                    {sessionTypeAbbrev(entry.session.session_type, entry.session.session_name)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="mono" style={{ color: 'var(--text-3)' }}>
                                …
                              </span>
                            )}
                          </td>
                          <td className="hide-mobile mono" style={{ color: 'var(--text-2)' }}>
                            {weekend && weekend.sessions.length > 0
                              ? `${weekend.sessions.filter((s) => s.source === 'local').length}/${weekend.sessions.length} full`
                              : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="dl-detail-wrap">
                {weekendsLoading && selectedWeekend == null && (
                  <div className="loading-state">loading weekend details…</div>
                )}
                {selectedWeekend && <MeetingDetailPanel weekend={selectedWeekend} />}
                {selectedMeetingKey != null && !weekendsLoading && selectedWeekend == null && (
                  <div className="missing-notice">Could not load weekend details.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="dl-footer-link">
        <Link to="/" className="dl-footer-back">
          ← Command Center
        </Link>
        <Link to="/race-hub" search={{}}>
          Open Race Hub →
        </Link>
      </div>
    </div>
  )
}
