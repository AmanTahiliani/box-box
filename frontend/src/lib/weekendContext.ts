import type {
  ChampionshipHub,
  ContextSession,
  EnrichedResult,
  Meeting,
  NewsItem,
  Session,
  WeekendBriefingItem,
  WeekendChampionshipImpact,
  WeekendChampionshipMover,
  WeekendContext,
  WeekendPodiumEntry,
  WeekendViewState,
} from '../types'

/**
 * resolveViewState maps the canonical `temporal_state` onto the rendered Weekend
 * view. It is a total function: every valid canonical `temporal_state` resolves
 * to a concrete view, so a well-formed payload never falls through to a
 * limited/empty placeholder. Loading and error are hook-level states that are
 * not part of the #72 contract.
 */
export function resolveViewState(context: WeekendContext): WeekendViewState {
  switch (context.temporal_state) {
    case 'no_season':
      return 'no_season'
    case 'between_weekends':
      return 'between_weekends'
    case 'pre_session':
      return 'pre_session'
    case 'session_live':
      return 'session_live'
    case 'session_settling':
      return 'session_settling'
    case 'between_sessions':
      return 'between_sessions'
    case 'post_weekend':
      return 'post_weekend'
    case 'season_complete':
      return 'season_complete'
    default:
      // Unknown/absent temporal_state is an invalid payload — treat as no_season
      // rather than inventing a state. The hook still shows an explicit surface.
      return 'no_season'
  }
}

export interface MeetingIdentity {
  meeting_key: number
  meeting_name: string
  short_name: string
  country_code: string
  country_flag: string
  circuit_short_name: string
  circuit_key?: number
  date_start?: string
  date_end?: string
}

/** Presentation identity for a meeting, tolerant of partial/absent fields. */
export function meetingIdentity(meeting: Meeting | undefined): MeetingIdentity | undefined {
  if (!meeting) return undefined
  return {
    meeting_key: meeting.meeting_key,
    meeting_name: meeting.meeting_name || meeting.location || 'Grand Prix',
    short_name: (meeting.meeting_name || meeting.location || 'Grand Prix').replace(/ Grand Prix$/i, ''),
    country_code: meeting.country_code,
    country_flag: meeting.country_flag,
    circuit_short_name: meeting.circuit_short_name || meeting.location || '',
    circuit_key: meeting.circuit_key,
    date_start: meeting.date_start || undefined,
    date_end: meeting.date_end || undefined,
  }
}

/** Session identity paired with its resolved meeting for a canonical ContextSession. */
export function sessionMeeting(ref: ContextSession | undefined): Meeting | undefined {
  return ref?.meeting
}

export function sessionOf(ref: ContextSession | undefined): Session | undefined {
  return ref?.session
}

/**
 * analysisSessionKey resolves the session a user should open to read analysis for
 * a completed event. It prefers the canonical default analysis session, falling
 * back to the previous completed session. Returns undefined when nothing analysable
 * is available (e.g. an archived result with no local analysis).
 */
export function analysisSessionKey(context: WeekendContext): number | undefined {
  const key =
    context.default_analysis_session?.session.session_key ??
    context.previous_completed_session?.session.session_key
  return key && key > 0 ? key : undefined
}

/** True when a ContextSession has local analysis worth linking to. */
export function hasLocalAnalysis(ref: ContextSession | undefined): boolean {
  const status = ref?.availability.local_analysis
  return status === 'complete' || status === 'partial'
}

/** Countdown target for a session reference — its scheduled start, if known. */
export function sessionStart(ref: ContextSession | undefined): string | undefined {
  const start = ref?.session.date_start
  return start ? start : undefined
}

export function podiumFromResults(results: EnrichedResult[]): WeekendPodiumEntry[] {
  return [...results]
    .filter((r) => r.position >= 1)
    .sort((a, b) => a.position - b.position)
    .slice(0, 3)
    .map((r) => ({
      position: r.position,
      driver_number: r.driver_number,
      name_acronym: r.name_acronym,
      team_name: r.team_name,
      team_colour: r.team_colour,
      gap: formatResultGap(r),
    }))
}

function formatResultGap(r: EnrichedResult): string {
  if (r.dnf) return 'DNF'
  if (r.dns) return 'DNS'
  if (r.dsq) return 'DSQ'
  if (r.position === 1) {
    if (typeof r.duration === 'number' && r.duration > 0) return formatDuration(r.duration)
    return 'Winner'
  }
  const gap = Array.isArray(r.gap_to_leader) ? r.gap_to_leader[r.gap_to_leader.length - 1] : r.gap_to_leader
  if (typeof gap === 'number') return `+${gap.toFixed(3)}`
  if (typeof gap === 'string' && gap) return gap.startsWith('+') ? gap : `+${gap}`
  return '—'
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`
  return `${m}:${s.toFixed(3).padStart(6, '0')}`
}

/**
 * championshipImpact derives the top-of-standings movers from the championship
 * hub. This is supplementary data layered onto the canonical context, not part of
 * the #72 contract.
 */
export function championshipImpact(hub: ChampionshipHub | undefined): WeekendChampionshipImpact | undefined {
  if (!hub || hub.drivers.length === 0) return undefined
  const leaders: WeekendChampionshipMover[] = hub.drivers.slice(0, 3).map((d) => {
    const cumulative = d.cumulative ?? []
    const delta =
      cumulative.length >= 2 ? cumulative[cumulative.length - 1] - cumulative[cumulative.length - 2] : undefined
    return {
      position: d.position,
      driver_number: d.driver_number,
      name_acronym: d.name_acronym,
      team_colour: d.team_colour,
      points: d.points,
      delta,
    }
  })
  const note = hub.last_race ? `Standings after ${hub.last_race}.` : undefined
  return { leaders, note }
}

/** At most three briefing items, mapped from the news feed. */
export function briefingItems(news: NewsItem[]): WeekendBriefingItem[] {
  return news.slice(0, 3).map((item) => ({
    category: item.category,
    title: item.title,
    url: item.url,
    source: item.source,
    published_at: item.published_at,
    image_url: item.og_image_url,
  }))
}
