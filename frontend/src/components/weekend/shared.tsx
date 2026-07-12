import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { fetchRaceHub } from '../../api'
import { countryFlag } from '../../lib/gpIdentity'
import { parseScheduleTime } from '../../lib/schedule'
import { podiumFromResults } from '../../lib/weekendContext'
import { teamColor } from '../../utils'
import type {
  WeekendChampionshipImpact,
  WeekendCompletedEvent,
  WeekendBriefingItem,
  WeekendPodiumEntry,
  WeekendSeasonRound,
  WeekendTimelineSession,
} from '../../types'

export function Flag({ code, flag }: { code?: string; flag?: string }) {
  const glyph = countryFlag({ country_code: code ?? '', country_flag: flag ?? '' })
  if (!glyph) return null
  return <span className="wk-flag" aria-hidden="true">{glyph}</span>
}

interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
  reached: boolean
}

export function countdownParts(target: string | undefined, now: Date): CountdownParts | null {
  const date = target ? parseScheduleTime(target) : null
  if (!date) return null
  const diff = date.getTime() - now.getTime()
  const clamped = Math.max(0, diff)
  const totalSeconds = Math.floor(clamped / 1000)
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    reached: diff <= 0,
  }
}

export function CountdownDisplay({
  target,
  now,
  compact,
}: {
  target: string | undefined
  now: Date
  compact?: boolean
}) {
  const parts = countdownParts(target, now)
  if (!parts) return null
  if (parts.reached) {
    return <span className="wk-countdown-live" data-testid="wk-countdown">Starting now</span>
  }
  if (compact || parts.days === 0) {
    const hh = String(parts.days * 24 + parts.hours).padStart(2, '0')
    return (
      <span className="wk-countdown-clock mono" data-testid="wk-countdown">
        {hh}:{String(parts.minutes).padStart(2, '0')}:{String(parts.seconds).padStart(2, '0')}
      </span>
    )
  }
  return (
    <span className="wk-countdown" data-testid="wk-countdown">
      <span className="wk-count-unit"><b>{parts.days}</b>D</span>
      <span className="wk-count-unit"><b>{String(parts.hours).padStart(2, '0')}</b>H</span>
      <span className="wk-count-unit"><b>{String(parts.minutes).padStart(2, '0')}</b>M</span>
    </span>
  )
}

export function EventPodium({ event }: { event: WeekendCompletedEvent }) {
  const needsFetch = event.podium.length === 0 && event.analysis_session_key > 0
  const query = useQuery({
    queryKey: ['race-hub', event.analysis_session_key, 'podium'],
    queryFn: () => fetchRaceHub(event.analysis_session_key),
    enabled: needsFetch,
    staleTime: 60_000,
  })

  const podium: WeekendPodiumEntry[] =
    event.podium.length > 0 ? event.podium : podiumFromResults(query.data?.results ?? [])

  if (podium.length === 0) {
    return (
      <div className="wk-podium-empty" data-testid="wk-podium-empty">
        {query.isLoading ? 'Loading result…' : 'Result not available yet.'}
      </div>
    )
  }

  return (
    <ol className="wk-podium" data-testid="wk-podium">
      {podium.map((p) => (
        <li key={p.driver_number} className="wk-podium-row" style={{ ['--wk-team' as string]: teamColor(p.team_colour) }}>
          <span className="wk-podium-pos mono">{p.position}</span>
          <span className="wk-podium-code">{p.name_acronym}</span>
          <span className="wk-podium-gap mono">{p.gap}</span>
        </li>
      ))}
    </ol>
  )
}

export function ChampionshipImpactCard({ impact }: { impact: WeekendChampionshipImpact }) {
  const leader = impact.leaders[0]
  return (
    <section className="wk-champ" data-testid="wk-champ-impact">
      <header className="wk-card-head">
        <span className="wk-card-title">Championship impact</span>
        <Link to="/championship" className="wk-card-link">Standings →</Link>
      </header>
      <ol className="wk-champ-list">
        {impact.leaders.map((d) => {
          const gap = leader && d.position !== 1 ? leader.points - d.points : 0
          return (
            <li key={d.driver_number} className="wk-champ-row" style={{ ['--wk-team' as string]: teamColor(d.team_colour) }}>
              <span className="wk-champ-pos mono">{d.position}</span>
              <span className="wk-champ-code">{d.name_acronym}</span>
              <span className="wk-champ-pts mono">{d.points}</span>
              <span className="wk-champ-gap mono">{d.position === 1 ? '—' : `-${gap}`}</span>
            </li>
          )
        })}
      </ol>
      {impact.note && <p className="wk-champ-note">{impact.note}</p>}
    </section>
  )
}

export function BriefingStrip({ items }: { items: WeekendBriefingItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="wk-briefing" data-testid="wk-briefing">
      <header className="wk-card-head">
        <span className="wk-card-title">Since the chequered flag</span>
        <Link to="/briefing" className="wk-card-link">All briefing →</Link>
      </header>
      <ul className="wk-briefing-list">
        {items.map((item) => (
          <li key={item.url} className="wk-briefing-item">
            <a href={item.url} target="_blank" rel="noreferrer" className="wk-briefing-link">
              {item.category && <span className="wk-briefing-cat mono">{item.category}</span>}
              <span className="wk-briefing-title">{item.title}</span>
              <span className="wk-briefing-source mono">{item.source}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SeasonNavStrip({ rounds }: { rounds: WeekendSeasonRound[] }) {
  if (rounds.length === 0) return null
  return (
    <section className="wk-season-nav" data-testid="wk-season-nav" aria-label="Season calendar">
      <ol className="wk-season-strip" role="list">
        {rounds.map((round) => {
          const inner = (
            <>
              <span className="wk-round-num mono">R{String(round.round).padStart(2, '0')}</span>
              <span className="wk-round-flag">{countryFlag({ country_code: round.country_code, country_flag: round.country_flag }) || round.country_code}</span>
              <span className={`wk-round-dot wk-round-${round.status}`} aria-hidden="true" />
            </>
          )
          const className = `wk-round wk-round-status-${round.status}`
          return (
            <li key={round.meeting_key} className="wk-round-item" role="listitem">
              {round.analysis_session_key ? (
                <Link
                  to="/race-hub"
                  search={{ session_key: round.analysis_session_key }}
                  className={className}
                  aria-label={`Round ${round.round} ${round.country_code} — ${round.status}`}
                >
                  {inner}
                </Link>
              ) : (
                <span className={className} aria-label={`Round ${round.round} ${round.country_code} — ${round.status}`}>
                  {inner}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <div className="wk-season-legend mono" aria-hidden="true">
        <span><i className="wk-round-dot wk-round-completed" /> Completed</span>
        <span><i className="wk-round-dot wk-round-next" /> Next</span>
        <span><i className="wk-round-dot wk-round-upcoming" /> Upcoming</span>
      </div>
    </section>
  )
}

export function SessionTimeline({ sessions }: { sessions: WeekendTimelineSession[] }) {
  if (sessions.length === 0) return null
  return (
    <ol className="wk-timeline" data-testid="wk-timeline" role="list">
      {sessions.map((s) => (
        <li key={s.session_key} className={`wk-timeline-node wk-timeline-${s.status}`} role="listitem">
          <span className="wk-timeline-dot" aria-hidden="true" />
          <span className="wk-timeline-name">{shortSessionName(s.session_name)}</span>
          <span className="wk-timeline-state mono">{stateLabel(s.status)}</span>
        </li>
      ))}
    </ol>
  )
}

function shortSessionName(name: string): string {
  const map: Record<string, string> = {
    'Practice 1': 'FP1',
    'Practice 2': 'FP2',
    'Practice 3': 'FP3',
    Qualifying: 'Quali',
    'Sprint Qualifying': 'SQ',
    'Sprint Shootout': 'SQ',
  }
  return map[name] ?? name
}

function stateLabel(status: WeekendTimelineSession['status']): string {
  switch (status) {
    case 'done':
      return 'Complete'
    case 'live':
      return 'Live'
    case 'next':
      return 'Next'
    default:
      return 'Upcoming'
  }
}
