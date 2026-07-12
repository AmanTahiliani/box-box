import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { fetchRaceHub } from '../../api'
import { countryFlag } from '../../lib/gpIdentity'
import { parseScheduleTime } from '../../lib/schedule'
import { podiumFromResults } from '../../lib/weekendContext'
import { teamColor } from '../../utils'
import type {
  ContextSession,
  WeekendChampionshipImpact,
  WeekendBriefingItem,
  WeekendPodiumEntry,
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
  if (!parts) {
    return (
      <span className="wk-countdown-tbc mono" data-testid="wk-countdown">
        Schedule TBC
      </span>
    )
  }
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

/**
 * EventPodium fetches and renders the podium for a completed analysis session.
 * When no analysable session key is available (e.g. an archived result with no
 * local analysis), it renders an explicit empty state rather than fetching.
 */
export function EventPodium({ sessionKey }: { sessionKey?: number }) {
  const enabled = typeof sessionKey === 'number' && sessionKey > 0
  const query = useQuery({
    queryKey: ['race-hub', sessionKey, 'podium'],
    queryFn: () => fetchRaceHub(sessionKey as number),
    enabled,
    staleTime: 60_000,
  })

  const podium: WeekendPodiumEntry[] = podiumFromResults(query.data?.results ?? [])

  if (!enabled) {
    return (
      <div className="wk-podium-empty" data-testid="wk-podium-empty">
        Result not available yet.
      </div>
    )
  }

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

/**
 * ChampionshipRoundStrip is a compact, progressively-disclosed round indicator.
 * The canonical contract exposes only the current round and total, so the strip
 * shows "Round N of M" and links out to Explore for the full calendar rather than
 * reintroducing the whole calendar on the Weekend home.
 */
export function ChampionshipRoundStrip({ round, total }: { round: number; total: number }) {
  if (round <= 0 || total <= 0) return null
  const pct = Math.min(100, Math.round((round / total) * 100))
  return (
    <section className="wk-season-nav" data-testid="wk-season-nav" aria-label="Season progress">
      <div className="wk-season-progress">
        <div className="wk-season-progress-head">
          <span className="wk-card-title">Season progress</span>
          <Link to="/explore" className="wk-card-link" data-testid="wk-season-explore">
            Full calendar →
          </Link>
        </div>
        <div
          className="wk-season-bar"
          role="progressbar"
          aria-valuenow={round}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Round ${round} of ${total}`}
        >
          <span className="wk-season-bar-fill" style={{ width: `${pct}%` }} aria-hidden="true" />
        </div>
        <p className="wk-season-progress-label mono">
          Round {round} of {total}
        </p>
      </div>
    </section>
  )
}

interface TimelineNode {
  key: string
  session_name: string
  status: 'done' | 'live' | 'next'
}

/**
 * SessionRail renders the previous/active/next sessions the canonical context
 * exposes as a compact three-node rail. It is intentionally derived only from the
 * canonical refs — the contract does not enumerate a full weekend session list.
 */
export function SessionRail({ nodes }: { nodes: TimelineNode[] }) {
  if (nodes.length === 0) return null
  return (
    <ol className="wk-timeline" data-testid="wk-timeline" role="list">
      {nodes.map((n) => (
        <li key={n.key} className={`wk-timeline-node wk-timeline-${n.status}`} role="listitem">
          <span className="wk-timeline-dot" aria-hidden="true" />
          <span className="wk-timeline-name">{shortSessionName(n.session_name)}</span>
          <span className="wk-timeline-state mono">{stateLabel(n.status)}</span>
        </li>
      ))}
    </ol>
  )
}

/** Build the compact session rail from the canonical previous/active/next refs. */
export function railNodes(
  previous: ContextSession | undefined,
  active: ContextSession | undefined,
  next: ContextSession | undefined,
): TimelineNode[] {
  const nodes: TimelineNode[] = []
  if (previous?.session.session_name) {
    nodes.push({ key: `prev-${previous.session.session_key}`, session_name: previous.session.session_name, status: 'done' })
  }
  if (active?.session.session_name) {
    nodes.push({ key: `live-${active.session.session_key}`, session_name: active.session.session_name, status: 'live' })
  }
  if (next?.session.session_name) {
    nodes.push({ key: `next-${next.session.session_key}`, session_name: next.session.session_name, status: 'next' })
  }
  return nodes
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

function stateLabel(status: TimelineNode['status']): string {
  switch (status) {
    case 'done':
      return 'Complete'
    case 'live':
      return 'Live'
    default:
      return 'Next'
  }
}
