import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  fetchChampionshipHub,
  fetchLocalMeetings,
  fetchSeasonMeetings,
  fetchSeasons,
  fetchWeekend,
} from '../api'
import { countryFlag, formatGpDateRange } from '../lib/gpIdentity'
import { meetingHasStarted } from '../lib/schedule'
import { teamColor } from '../utils'
import type { Weekend } from '../types'
import '../styles/weekend.css'

function analysisKey(weekend: Weekend | undefined): number | undefined {
  if (!weekend) return undefined
  const race = weekend.sessions.find((s) => s.session.session_type?.toLowerCase().includes('race'))
  return race?.session.session_key ?? weekend.default_session_key
}

export function ExplorePage() {
  const now = useMemo(() => new Date(), [])

  const seasonsQuery = useQuery({
    queryKey: ['seasons'],
    queryFn: ({ signal }) => fetchSeasons(signal),
  })
  const season = seasonsQuery.data?.[0] ?? null

  const localMeetingsQuery = useQuery({
    queryKey: ['meetings', season, 'local'],
    queryFn: ({ signal }) => fetchLocalMeetings(season!, signal),
    enabled: season != null,
  })
  const seasonMeetingsQuery = useQuery({
    queryKey: ['season-meetings', season],
    queryFn: ({ signal }) => fetchSeasonMeetings(season!, signal),
    enabled: season != null,
  })
  const championshipQuery = useQuery({
    queryKey: ['championship-hub', season],
    queryFn: ({ signal }) => fetchChampionshipHub(season!, signal),
    enabled: season != null,
  })

  const localMeetings = localMeetingsQuery.data ?? []
  const meetings = seasonMeetingsQuery.data?.length ? seasonMeetingsQuery.data : localMeetings

  const weekendQueries = useQueries({
    queries: localMeetings.map((m) => ({
      queryKey: ['weekend', m.meeting_key],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchWeekend(m.meeting_key, signal),
      enabled: localMeetings.length > 0,
      staleTime: 60_000,
    })),
  })
  const weekendsByKey = useMemo(() => {
    const map = new Map<number, Weekend>()
    localMeetings.forEach((m, i) => {
      const data = weekendQueries[i]?.data
      if (data) map.set(m.meeting_key, data)
    })
    return map
  }, [localMeetings, weekendQueries])

  const drivers = championshipQuery.data?.drivers ?? []
  const activeMeetings = meetings.filter((m) => !m.is_cancelled)

  if (seasonsQuery.isLoading) {
    return <div className="wk-status" data-testid="explore-loading"><p className="wk-status-title">Loading…</p></div>
  }

  return (
    <main className="wk-page wk-explore" data-testid="explore-page">
      <div className="wk-eyebrow mono">Explore · {season ?? 'season'}</div>

      <section className="wk-explore-section" aria-labelledby="explore-calendar-title">
        <header className="wk-card-head">
          <span className="wk-card-title" id="explore-calendar-title">Season races</span>
          <span className="wk-card-link mono">{activeMeetings.length} rounds</span>
        </header>
        {activeMeetings.length === 0 ? (
          <p className="wk-status-sub" data-testid="explore-calendar-empty">No season calendar available yet.</p>
        ) : (
          <ol className="wk-explore-grid" role="list">
            {activeMeetings.map((meeting, index) => {
              const weekend = weekendsByKey.get(meeting.meeting_key)
              const target = analysisKey(weekend)
              const done = meetingHasStarted(meeting, now)
              const card = (
                <>
                  <div className="wk-explore-top mono">
                    <span>R{String(index + 1).padStart(2, '0')}</span>
                    <span className="wk-explore-flag">
                      {countryFlag(meeting) || meeting.country_code}
                    </span>
                  </div>
                  <div className="wk-explore-name">{meeting.meeting_name}</div>
                  <div className="wk-explore-meta mono">{meeting.circuit_short_name || meeting.location}</div>
                  <div className="wk-explore-meta mono">{formatGpDateRange(meeting)}</div>
                  <span className={`wk-explore-state ${done ? 'is-done' : 'is-upcoming'}`}>
                    {done ? 'Completed' : 'Upcoming'}
                  </span>
                </>
              )
              return (
                <li key={meeting.meeting_key} className="wk-explore-item" role="listitem">
                  {target ? (
                    <Link
                      to="/race-hub"
                      search={{ session_key: target }}
                      className="wk-explore-card is-link"
                      data-testid={`explore-race-${meeting.meeting_key}`}
                    >
                      {card}
                    </Link>
                  ) : (
                    <div className="wk-explore-card" data-testid={`explore-race-${meeting.meeting_key}`}>{card}</div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <section className="wk-explore-section" aria-labelledby="explore-drivers-title">
        <header className="wk-card-head">
          <span className="wk-card-title" id="explore-drivers-title">Drivers</span>
          <Link to="/championship" className="wk-card-link">Championship →</Link>
        </header>
        {drivers.length === 0 ? (
          <p className="wk-status-sub" data-testid="explore-drivers-empty">Driver data not available yet.</p>
        ) : (
          <ol className="wk-explore-drivers" role="list">
            {drivers.map((d) => (
              <li key={d.driver_number} role="listitem">
                <Link
                  to="/drivers/$driverNumber"
                  params={{ driverNumber: String(d.driver_number) }}
                  search={season ? { year: season } : {}}
                  className="wk-driver-chip"
                  style={{ ['--wk-team' as string]: teamColor(d.team_colour) }}
                  data-testid={`explore-driver-${d.driver_number}`}
                >
                  <span className="wk-driver-pos mono">{d.position}</span>
                  <span className="wk-driver-code">{d.name_acronym}</span>
                  <span className="wk-driver-pts mono">{d.points}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}
