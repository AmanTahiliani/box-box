import { describe, it, expect } from 'vitest'
import {
  analysisSessionKey,
  briefingItems,
  championshipImpact,
  hasLocalAnalysis,
  meetingIdentity,
  podiumFromResults,
  resolveViewState,
} from '../lib/weekendContext'
import type {
  ChampionshipHub,
  ContextAvailability,
  ContextSession,
  EnrichedResult,
  Meeting,
  NewsItem,
  Session,
  TemporalState,
  WeekendContext,
} from '../types'

function availability(overrides: Partial<ContextAvailability> = {}): ContextAvailability {
  return {
    schedule: 'available',
    live_transport: 'unknown',
    live_session: 'inactive',
    archive: 'unavailable',
    local_analysis: 'complete',
    freshness: 'fresh',
    limitations: [],
    ...overrides,
  }
}

function meeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    meeting_key: 1,
    meeting_name: 'British Grand Prix',
    meeting_official_name: 'FORMULA 1 BRITISH GRAND PRIX',
    location: 'Silverstone',
    country_name: 'United Kingdom',
    country_code: 'GBR',
    country_flag: '',
    circuit_key: 2,
    circuit_short_name: 'Silverstone',
    date_start: '2026-07-03T09:00:00Z',
    date_end: '2026-07-05T16:00:00Z',
    year: 2026,
    ...overrides,
  }
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    session_key: 11,
    session_name: 'Race',
    session_type: 'Race',
    meeting_key: 1,
    date_start: '2026-07-05T14:00:00Z',
    date_end: '2026-07-05T16:00:00Z',
    gmt_offset: '',
    ...overrides,
  }
}

function ctxSession(overrides: Partial<ContextSession> = {}): ContextSession {
  return {
    session: session(),
    meeting: meeting(),
    availability: availability(),
    ...overrides,
  }
}

function context(overrides: Partial<WeekendContext> = {}): WeekendContext {
  return {
    season: 2026,
    temporal_state: 'between_weekends',
    championship_round: 1,
    total_championship_rounds: 24,
    ...overrides,
  }
}

describe('resolveViewState', () => {
  const cases: Array<[TemporalState, string]> = [
    ['no_season', 'no_season'],
    ['between_weekends', 'between_weekends'],
    ['pre_session', 'pre_session'],
    ['session_live', 'session_live'],
    ['session_settling', 'session_settling'],
    ['between_sessions', 'between_sessions'],
    ['post_weekend', 'post_weekend'],
    ['season_complete', 'season_complete'],
  ]

  it.each(cases)('maps canonical temporal_state %s to view %s', (temporal, expected) => {
    expect(resolveViewState(context({ temporal_state: temporal }))).toBe(expected)
  })

  it('treats an unknown/absent temporal_state as no_season rather than inventing a state', () => {
    expect(resolveViewState(context({ temporal_state: 'garbage' as TemporalState }))).toBe('no_season')
  })
})

describe('analysisSessionKey', () => {
  it('prefers the default analysis session', () => {
    const ctx = context({
      default_analysis_session: ctxSession({ session: session({ session_key: 32 }) }),
      previous_completed_session: ctxSession({ session: session({ session_key: 11 }) }),
    })
    expect(analysisSessionKey(ctx)).toBe(32)
  })

  it('falls back to the previous completed session', () => {
    const ctx = context({
      previous_completed_session: ctxSession({ session: session({ session_key: 11 }) }),
    })
    expect(analysisSessionKey(ctx)).toBe(11)
  })

  it('returns undefined when there is no analysable session', () => {
    expect(analysisSessionKey(context())).toBeUndefined()
  })

  it('returns undefined for a zero/synthetic session key', () => {
    const ctx = context({
      previous_completed_session: ctxSession({ session: session({ session_key: 0 }) }),
    })
    expect(analysisSessionKey(ctx)).toBeUndefined()
  })
})

describe('hasLocalAnalysis', () => {
  it('is true for complete or partial local analysis', () => {
    expect(hasLocalAnalysis(ctxSession({ availability: availability({ local_analysis: 'complete' }) }))).toBe(true)
    expect(hasLocalAnalysis(ctxSession({ availability: availability({ local_analysis: 'partial' }) }))).toBe(true)
  })

  it('is false for pending/not_applicable/absent', () => {
    expect(hasLocalAnalysis(ctxSession({ availability: availability({ local_analysis: 'pending' }) }))).toBe(false)
    expect(hasLocalAnalysis(ctxSession({ availability: availability({ local_analysis: 'not_applicable' }) }))).toBe(false)
    expect(hasLocalAnalysis(undefined)).toBe(false)
  })
})

describe('meetingIdentity', () => {
  it('derives a short name and tolerates partial fields', () => {
    const id = meetingIdentity(meeting({ meeting_name: 'Monaco Grand Prix', circuit_short_name: '', location: 'Monaco' }))
    expect(id?.short_name).toBe('Monaco')
    expect(id?.circuit_short_name).toBe('Monaco')
  })

  it('returns undefined for an absent meeting', () => {
    expect(meetingIdentity(undefined)).toBeUndefined()
  })

  it('drops empty date strings', () => {
    const id = meetingIdentity(meeting({ date_start: '', date_end: '' }))
    expect(id?.date_start).toBeUndefined()
    expect(id?.date_end).toBeUndefined()
  })
})

describe('championshipImpact', () => {
  const hub: ChampionshipHub = {
    season: 2026,
    round: 2,
    total_rounds: 24,
    rounds_left: 22,
    last_race: 'British GP',
    round_labels: ['R1', 'R2'],
    drivers: [
      { driver_number: 1, name_acronym: 'VER', full_name: 'Max', team_name: 'RB', team_colour: '3671c6', points: 50, position: 1, wins: 2, podiums: 2, poles: 1, form: [], cumulative: [25, 50], teammate_wins: 0, teammate_losses: 0, round_positions: [] },
      { driver_number: 4, name_acronym: 'NOR', full_name: 'Lando', team_name: 'McL', team_colour: 'ff8000', points: 40, position: 2, wins: 1, podiums: 2, poles: 0, form: [], cumulative: [18, 40], teammate_wins: 0, teammate_losses: 0, round_positions: [] },
    ],
    teams: [],
  }

  it('maps top-3 movers with deltas and a note', () => {
    const impact = championshipImpact(hub)
    expect(impact?.leaders).toHaveLength(2)
    expect(impact?.leaders[0].delta).toBe(25)
    expect(impact?.note).toContain('British GP')
  })

  it('returns undefined for an empty hub', () => {
    expect(championshipImpact(undefined)).toBeUndefined()
    expect(championshipImpact({ ...hub, drivers: [] })).toBeUndefined()
  })
})

describe('briefingItems', () => {
  it('caps at three items and maps fields', () => {
    const news: NewsItem[] = Array.from({ length: 5 }, (_, i) => ({
      source: 'src',
      title: `Item ${i}`,
      url: `https://x/${i}`,
      fetched_at: '2026-07-06T00:00:00Z',
      category: 'news',
      og_image_url: 'img',
    }))
    const items = briefingItems(news)
    expect(items).toHaveLength(3)
    expect(items[0]).toMatchObject({ title: 'Item 0', image_url: 'img' })
  })
})

describe('podiumFromResults', () => {
  it('sorts by position, caps at three, and formats gaps', () => {
    const results: EnrichedResult[] = [
      { driver_number: 44, position: 2, name_acronym: 'HAM', full_name: 'Lewis', team_name: 'Ferrari', team_colour: 'e8002d', dnf: false, dns: false, dsq: false, duration: null, gap_to_leader: 5.123 } as EnrichedResult,
      { driver_number: 1, position: 1, name_acronym: 'VER', full_name: 'Max', team_name: 'RB', team_colour: '3671c6', dnf: false, dns: false, dsq: false, duration: 5400, gap_to_leader: null } as EnrichedResult,
      { driver_number: 16, position: 3, name_acronym: 'LEC', full_name: 'Charles', team_name: 'Ferrari', team_colour: 'e8002d', dnf: false, dns: false, dsq: false, duration: null, gap_to_leader: '+10.5' } as EnrichedResult,
      { driver_number: 55, position: 4, name_acronym: 'SAI', full_name: 'Carlos', team_name: 'W', team_colour: 'fff', dnf: false, dns: false, dsq: false, duration: null, gap_to_leader: 20 } as EnrichedResult,
    ]
    const podium = podiumFromResults(results)
    expect(podium.map((p) => p.name_acronym)).toEqual(['VER', 'HAM', 'LEC'])
    expect(podium[1].gap).toBe('+5.123')
    expect(podium[2].gap).toBe('+10.5')
  })
})
