import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { fetchLocalMeetings, fetchSeasons, fetchWeekend } from '../api'
import { formatCoverageHint, sessionTypeAbbrev } from '../lib/coverage'
import { countryDecal, formatGpDateRange } from '../lib/gpIdentity'

interface Props {
  currentMeetingKey?: number
  currentSessionKey?: number
  onClose: () => void
}

export function WeekendSwitcher({ currentMeetingKey, currentSessionKey, onClose }: Props) {
  const navigate = useNavigate()
  const seasonsQuery = useQuery({ queryKey: ['seasons'], queryFn: fetchSeasons })
  const [year, setYear] = useState<number | null>(null)
  const [openMeetingKey, setOpenMeetingKey] = useState<number | null>(
    currentMeetingKey ?? null,
  )

  useEffect(() => {
    if (year == null && seasonsQuery.data?.length) {
      setYear(seasonsQuery.data[0])
    }
  }, [seasonsQuery.data, year])

  const meetingsQuery = useQuery({
    queryKey: ['meetings', year],
    queryFn: () => fetchLocalMeetings(year!),
    enabled: year != null,
  })

  const weekendQuery = useQuery({
    queryKey: ['weekend', openMeetingKey],
    queryFn: () => fetchWeekend(openMeetingKey!),
    enabled: openMeetingKey != null,
  })

  const seasons = seasonsQuery.data ?? []
  const meetings = meetingsQuery.data ?? []
  const weekend = weekendQuery.data

  function openSession(sessionKey: number) {
    navigate({ to: '/race-hub', search: { session_key: sessionKey } })
    onClose()
  }

  return (
    <div className="rh-switcher" data-testid="rh-switcher">
      <div className="rh-switcher-head">
        <span className="sec-title">Switch Weekend</span>
        <div className="rh-switcher-years">
          {seasons.map((y) => (
            <button
              key={y}
              type="button"
              className={`rh-switcher-year${y === year ? ' active' : ''}`}
              onClick={() => {
                setYear(y)
                setOpenMeetingKey(null)
              }}
            >
              {y}
            </button>
          ))}
        </div>
        <button type="button" className="rh-switcher-close" onClick={onClose}>
          Close
        </button>
      </div>

      {meetingsQuery.isLoading && (
        <div className="rh-switcher-empty">loading meetings…</div>
      )}
      {!meetingsQuery.isLoading && meetings.length === 0 && (
        <div className="rh-switcher-empty">No meetings ingested for {year}.</div>
      )}

      {meetings.length > 0 && (
        <div className="rh-switcher-grid">
          {meetings.map((m) => {
            const expanded = m.meeting_key === openMeetingKey
            const isCurrent = m.meeting_key === currentMeetingKey
            return (
              <div
                key={m.meeting_key}
                className={`rh-switcher-mtg${expanded ? ' expanded' : ''}${isCurrent ? ' current' : ''}`}
              >
                <button
                  type="button"
                  className="rh-switcher-mtg-head"
                  aria-expanded={expanded}
                  onClick={() =>
                    setOpenMeetingKey((prev) => (prev === m.meeting_key ? null : m.meeting_key))
                  }
                  data-testid={`rh-switcher-meeting-${m.meeting_key}`}
                >
                  <span className="rh-switcher-decal mono">{countryDecal(m)}</span>
                  <span className="rh-switcher-mtg-name">{m.meeting_name}</span>
                  <span className="rh-switcher-mtg-meta mono">{formatGpDateRange(m)}</span>
                </button>

                {expanded && (
                  <div className="rh-switcher-sessions">
                    {weekendQuery.isLoading && (
                      <div className="rh-switcher-empty">loading sessions…</div>
                    )}
                    {weekend && weekend.meeting_key === m.meeting_key &&
                      weekend.sessions.map(({ session, source, datasets }) => {
                        const active = session.session_key === currentSessionKey
                        return (
                          <button
                            key={session.session_key}
                            type="button"
                            className={`rh-switcher-session${active ? ' active' : ''}`}
                            onClick={() => openSession(session.session_key)}
                            data-testid={`rh-switcher-session-${session.session_key}`}
                          >
                            <span className="rh-switcher-sess-abbrev mono">
                              {sessionTypeAbbrev(session.session_type, session.session_name)}
                            </span>
                            <span className="rh-switcher-sess-name">{session.session_name}</span>
                            <span className="rh-switcher-sess-cov mono">
                              <span className={`cc-cov-dot cc-cov-${source}`} aria-hidden="true" />
                              {formatCoverageHint(datasets)}
                            </span>
                          </button>
                        )
                      })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
