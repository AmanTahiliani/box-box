import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import {
  apiFetch,
  availabilityAwareStructuralSharing,
  clearApiFetchInflight,
  DATA_FRESHNESS_HEADER,
  DATA_SOURCE_HEADER,
  getResponseAvailability,
  rememberResponseAvailability,
} from '../lib/fetch'
import {
  aggregateNotices,
  noticeFromFreshness,
  noticeFromResponse,
  shouldShowEmbeddedNotice,
  weekendContextNotice,
} from '../lib/availability'
import type { WeekendContext } from '../types'

describe('response availability metadata', () => {
  beforeEach(() => {
    clearApiFetchInflight()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearApiFetchInflight()
  })

  it('captures CORS-readable source/freshness headers without changing the payload shape', async () => {
    const body = { season: 2026, drivers: [{ points: 1 }] }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            [DATA_SOURCE_HEADER]: 'openf1',
            [DATA_FRESHNESS_HEADER]: 'stale',
          },
        }),
      ),
    )

    const data = await apiFetch<typeof body>('/api/v1/championship/hub')
    expect(data).toEqual(body)
    expect(getResponseAvailability(data)).toEqual({ source: 'openf1', freshness: 'stale' })
  })

  it('preserves metadata through deduped in-flight subscribers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            [DATA_SOURCE_HEADER]: 'local',
            [DATA_FRESHNESS_HEADER]: 'partial',
          },
        }),
      ),
    )

    const a = apiFetch<{ ok: boolean }>('/api/v1/shared', { dedupeKey: 'meta-shared' })
    const b = apiFetch<{ ok: boolean }>('/api/v1/shared', { dedupeKey: 'meta-shared' })
    const [ra, rb] = await Promise.all([a, b])
    expect(ra).toBe(rb)
    expect(getResponseAvailability(ra)).toEqual({ source: 'local', freshness: 'partial' })
  })

  it('maps only reported freshness values and never invents stale', () => {
    expect(noticeFromFreshness('stale')).toBe('stale')
    expect(noticeFromFreshness('partial')).toBe('partial')
    expect(noticeFromFreshness('local')).toBe('local')
    expect(noticeFromFreshness('limited')).toBe('limited')
    expect(noticeFromFreshness('archive')).toBe('archive')
    expect(noticeFromFreshness('fresh')).toBeNull()
    expect(noticeFromFreshness('live')).toBeNull()
    expect(noticeFromFreshness(undefined)).toBeNull()
    expect(noticeFromFreshness('local', { includeLocal: false })).toBeNull()
  })

  it('reads notice from WeakMap metadata attached to a successful payload', () => {
    const hub = { season: 2025, drivers: [] as unknown[] }
    rememberResponseAvailability(hub, { source: 'openf1', freshness: 'stale' })
    expect(noticeFromResponse(hub)).toBe('stale')
  })

  it('dedupes only equivalent embedded Preview notices', () => {
    expect(shouldShowEmbeddedNotice('stale', 'partial')).toBe(true)
    expect(shouldShowEmbeddedNotice('partial', 'partial')).toBe(false)
    expect(shouldShowEmbeddedNotice('stale', null)).toBe(true)
    expect(shouldShowEmbeddedNotice(null, 'partial')).toBe(false)
  })

  it('aggregates conflicting sources by severity so Local cannot mask worse truth', () => {
    expect(aggregateNotices(['local', 'stale'])).toBe('stale')
    expect(aggregateNotices(['local', 'partial'])).toBe('partial')
    expect(aggregateNotices(['local', 'limited'])).toBe('limited')
    expect(aggregateNotices(['local', 'archive'])).toBe('archive')
    expect(aggregateNotices(['stale', 'partial', 'local'])).toBe('partial')
    expect(aggregateNotices(['stale', 'stale', null])).toBe('stale')
    expect(aggregateNotices([null, undefined])).toBeNull()
  })

  it('derives Weekend Context notices from typed session freshness, skipping routine local', () => {
    const context: WeekendContext = {
      season: 2026,
      temporal_state: 'pre_session',
      championship_round: 1,
      total_championship_rounds: 24,
      focus_meeting: {
        meeting_key: 2,
        meeting_name: 'Belgian Grand Prix',
        meeting_official_name: '',
        location: 'Spa',
        country_name: 'Belgium',
        country_code: 'BEL',
        country_flag: '',
        circuit_key: 7,
        circuit_short_name: 'Spa',
        date_start: '2026-07-24T09:00:00Z',
        date_end: '2026-07-26T16:00:00Z',
        year: 2026,
      },
      next_session: {
        session: {
          session_key: 21,
          session_name: 'FP1',
          session_type: 'Practice',
          meeting_key: 2,
          date_start: '2026-07-24T09:00:00Z',
          date_end: '2026-07-24T10:00:00Z',
          gmt_offset: '',
        },
        meeting: {
          meeting_key: 2,
          meeting_name: 'Belgian Grand Prix',
          meeting_official_name: '',
          location: 'Spa',
          country_name: 'Belgium',
          country_code: 'BEL',
          country_flag: '',
          circuit_key: 7,
          circuit_short_name: 'Spa',
          date_start: '2026-07-24T09:00:00Z',
          date_end: '2026-07-26T16:00:00Z',
          year: 2026,
        },
        availability: {
          source: 'local',
          schedule: 'available',
          live_transport: 'unknown',
          live_session: 'inactive',
          archive: 'unavailable',
          local_analysis: 'partial',
          freshness: 'partial',
          limitations: [],
        },
      },
    }
    expect(weekendContextNotice(context)).toBe('partial')

    const localOnly: WeekendContext = {
      ...context,
      next_session: {
        ...context.next_session!,
        availability: {
          ...context.next_session!.availability,
          local_analysis: 'pending',
          freshness: 'local',
        },
      },
    }
    expect(weekendContextNotice(localOnly)).toBeNull()
  })

  it('authoritative Weekend header local/local does not fall through to previous archive', () => {
    const focusMeeting = {
      meeting_key: 2,
      meeting_name: 'Belgian Grand Prix',
      meeting_official_name: '',
      location: 'Spa',
      country_name: 'Belgium',
      country_code: 'BEL',
      country_flag: '',
      circuit_key: 7,
      circuit_short_name: 'Spa',
      date_start: '2026-07-10T09:00:00Z',
      date_end: '2026-07-12T16:00:00Z',
      year: 2026,
    }
    const previousMeeting = {
      ...focusMeeting,
      meeting_key: 1,
      meeting_name: 'British Grand Prix',
      circuit_short_name: 'Silverstone',
      location: 'Silverstone',
      country_name: 'United Kingdom',
      country_code: 'GBR',
    }
    const context: WeekendContext = {
      season: 2026,
      temporal_state: 'between_sessions',
      championship_round: 12,
      total_championship_rounds: 24,
      focus_meeting: focusMeeting,
      next_session: {
        session: {
          session_key: 21,
          session_name: 'Practice 1',
          session_type: 'Practice',
          meeting_key: 2,
          date_start: '2026-07-10T09:00:00Z',
          date_end: '2026-07-10T10:00:00Z',
          gmt_offset: '',
        },
        meeting: focusMeeting,
        availability: {
          source: 'local',
          schedule: 'available',
          live_transport: 'unknown',
          live_session: 'inactive',
          archive: 'unavailable',
          local_analysis: 'pending',
          freshness: 'local',
          limitations: [],
        },
      },
      previous_completed_session: {
        session: {
          session_key: 99,
          session_name: 'Race',
          session_type: 'Race',
          meeting_key: 1,
          date_start: '2026-07-05T14:00:00Z',
          date_end: '2026-07-05T16:00:00Z',
          gmt_offset: '',
        },
        meeting: previousMeeting,
        availability: {
          source: 'fia',
          schedule: 'available',
          live_transport: 'unknown',
          live_session: 'inactive',
          archive: 'available',
          local_analysis: 'complete',
          freshness: 'archive',
          limitations: [],
        },
      },
    }

    rememberResponseAvailability(context, { source: 'local', freshness: 'local' })
    expect(weekendContextNotice(context)).toBeNull()

    // Without an authoritative header, typed focus (upcoming local) still suppresses Local.
    const noHeader: WeekendContext = { ...context }
    expect(weekendContextNotice(noHeader)).toBeNull()
  })

  it('updates metadata when structural sharing reuses an equal JSON object', () => {
    const body = { season: 2026, drivers: [{ points: 1 }] }
    const first = structuredClone(body)
    const second = structuredClone(body)
    rememberResponseAvailability(first, { source: 'openf1', freshness: 'stale' })
    rememberResponseAvailability(second, { source: 'openf1', freshness: 'fresh' })

    const shared = availabilityAwareStructuralSharing(first, second)
    expect(shared).toBe(first)
    expect(getResponseAvailability(shared)).toEqual({ source: 'openf1', freshness: 'fresh' })
    expect(noticeFromResponse(shared)).toBeNull()

    const third = structuredClone(body)
    rememberResponseAvailability(third, { source: 'openf1', freshness: 'partial' })
    const sharedAgain = availabilityAwareStructuralSharing(shared, third)
    expect(sharedAgain).toBe(first)
    expect(noticeFromResponse(sharedAgain)).toBe('partial')
  })

  it('QueryObserver stale→fresh and fresh→partial refetches update metadata and notices', async () => {
    const body = { season: 2026, drivers: [{ points: 42 }] }
    const sequence: Array<'stale' | 'fresh' | 'partial'> = ['stale', 'fresh', 'partial']
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const freshness = sequence[Math.min(call, sequence.length - 1)]
        call += 1
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            [DATA_SOURCE_HEADER]: 'openf1',
            [DATA_FRESHNESS_HEADER]: freshness,
          },
        })
      }),
    )

    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          structuralSharing: availabilityAwareStructuralSharing,
        },
      },
    })
    const observer = new QueryObserver(client, {
      queryKey: ['availability-observer'],
      queryFn: () => apiFetch<typeof body>('/api/v1/championship/hub'),
      staleTime: 0,
    })

    const notices: Array<string | null> = []
    const unsub = observer.subscribe((result) => {
      if (result.data) notices.push(noticeFromResponse(result.data))
    })

    await observer.refetch()
    expect(noticeFromResponse(observer.getCurrentResult().data)).toBe('stale')
    expect(notices[notices.length - 1]).toBe('stale')

    await observer.refetch()
    expect(observer.getCurrentResult().data).toEqual(body)
    expect(getResponseAvailability(observer.getCurrentResult().data!)).toEqual({
      source: 'openf1',
      freshness: 'fresh',
    })
    expect(noticeFromResponse(observer.getCurrentResult().data)).toBeNull()
    expect(notices[notices.length - 1]).toBeNull()

    await observer.refetch()
    expect(noticeFromResponse(observer.getCurrentResult().data)).toBe('partial')
    expect(notices[notices.length - 1]).toBe('partial')
    expect(call).toBe(3)

    unsub()
    client.clear()
  })
})
