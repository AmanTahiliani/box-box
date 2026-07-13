import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  apiFetch,
  clearApiFetchInflight,
  DATA_FRESHNESS_HEADER,
  DATA_SOURCE_HEADER,
  getResponseAvailability,
  rememberResponseAvailability,
} from '../lib/fetch'
import {
  noticeFromFreshness,
  noticeFromResponse,
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

  it('derives Weekend Context notices from typed session freshness, skipping routine local', () => {
    const context: WeekendContext = {
      season: 2026,
      temporal_state: 'pre_session',
      championship_round: 1,
      total_championship_rounds: 24,
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
})
