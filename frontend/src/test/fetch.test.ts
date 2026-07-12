import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  apiFetch,
  clearApiFetchInflight,
  DEFAULT_FETCH_TIMEOUT_MS,
  isTimeoutError,
  userFacingError,
} from '../lib/fetch'

describe('apiFetch', () => {
  beforeEach(() => {
    clearApiFetchInflight()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    clearApiFetchInflight()
  })

  it('resolves JSON within the timeout boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(apiFetch<{ ok: boolean }>('/api/v1/ping')).resolves.toEqual({ ok: true })
  })

  it('times out and leaves no hanging promise after the deadline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (!signal) return
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      }),
    )

    const pending = apiFetch('/api/v1/slow', { timeoutMs: 1000 })
    const assertion = expect(pending).rejects.toSatisfy(
      (err: unknown) => isTimeoutError(err) && userFacingError(err).includes('too long'),
    )

    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })

  it('propagates caller abort as an ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      }),
    )

    const controller = new AbortController()
    const pending = apiFetch('/api/v1/abort-me', {
      signal: controller.signal,
      timeoutMs: 30_000,
    })
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'abort' })
    controller.abort()
    await assertion
  })

  it('deduplicates concurrent in-flight requests for the same key', async () => {
    let starts = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        starts += 1
        await new Promise((r) => setTimeout(r, 50))
        return new Response(JSON.stringify({ n: starts }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )

    const a = apiFetch<{ n: number }>('/api/v1/shared', { dedupeKey: 'shared' })
    const b = apiFetch<{ n: number }>('/api/v1/shared', { dedupeKey: 'shared' })
    await vi.advanceTimersByTimeAsync(50)
    const [ra, rb] = await Promise.all([a, b])
    expect(starts).toBe(1)
    expect(ra).toEqual(rb)
  })

  it('allows an explicit retry after the prior request settles', async () => {
    let starts = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        starts += 1
        return new Response(JSON.stringify({ starts }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )

    await expect(apiFetch('/api/v1/retry', { dedupeKey: 'retry-once' })).resolves.toEqual({
      starts: 1,
    })
    await expect(apiFetch('/api/v1/retry', { dedupeKey: 'retry-once' })).resolves.toEqual({
      starts: 2,
    })
    expect(starts).toBe(2)
  })

  it('maps HTTP errors without raw status jargon in userFacingError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'upstream failed', stale: true }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    try {
      await apiFetch('/api/v1/fail')
      expect.unreachable('should throw')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).stale).toBe(true)
      expect(userFacingError(err)).not.toMatch(/502|API /)
      expect(userFacingError(err)).toMatch(/cached|Retry/i)
    }
  })

  it('uses the default primary-route timeout', () => {
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBe(15_000)
  })
})
