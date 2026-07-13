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

  it('does not poison a second caller when the first aborts the same dedupe key', async () => {
    let starts = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        starts += 1
        return new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve(
              new Response(JSON.stringify({ ok: true, starts }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }, 100)
          init?.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer)
              reject(new DOMException('Aborted', 'AbortError'))
            },
            { once: true },
          )
        })
      }),
    )

    const first = new AbortController()
    const second = new AbortController()
    const a = apiFetch<{ ok: boolean }>('/api/v1/shared', {
      dedupeKey: 'shared-abort-safe',
      signal: first.signal,
      timeoutMs: 30_000,
    })
    const b = apiFetch<{ ok: boolean }>('/api/v1/shared', {
      dedupeKey: 'shared-abort-safe',
      signal: second.signal,
      timeoutMs: 30_000,
    })

    first.abort()
    await expect(a).rejects.toMatchObject({ kind: 'abort' })

    await vi.advanceTimersByTimeAsync(100)
    await expect(b).resolves.toEqual({ ok: true, starts: 1 })
    expect(starts).toBe(1)
  })

  it('cancels the shared request only after the last subscriber aborts', async () => {
    let aborted = false
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              aborted = true
              reject(new DOMException('Aborted', 'AbortError'))
            },
            { once: true },
          )
        })
      }),
    )

    const first = new AbortController()
    const second = new AbortController()
    const a = apiFetch('/api/v1/shared', {
      dedupeKey: 'shared-last-abort',
      signal: first.signal,
      timeoutMs: 30_000,
    })
    const b = apiFetch('/api/v1/shared', {
      dedupeKey: 'shared-last-abort',
      signal: second.signal,
      timeoutMs: 30_000,
    })

    first.abort()
    await expect(a).rejects.toMatchObject({ kind: 'abort' })
    expect(aborted).toBe(false)

    second.abort()
    await expect(b).rejects.toMatchObject({ kind: 'abort' })
    expect(aborted).toBe(true)
  })

  it('survives a Strict Mode style remount: aborted first consumer, fresh second consumer', async () => {
    let starts = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        starts += 1
        return new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve(
              new Response(JSON.stringify({ starts }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            )
          }, 50)
          init?.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer)
              reject(new DOMException('Aborted', 'AbortError'))
            },
            { once: true },
          )
        })
      }),
    )

    // Mount #1
    const first = new AbortController()
    const pendingFirst = apiFetch<{ starts: number }>('/api/v1/seasons', {
      dedupeKey: 'seasons',
      signal: first.signal,
      timeoutMs: 30_000,
    })

    // Strict Mode unmount cancels the first subscription (sole subscriber → shared abort)
    first.abort()
    await expect(pendingFirst).rejects.toMatchObject({ kind: 'abort' })

    // Remount starts a fresh consumer — must not inherit the aborted request
    const second = new AbortController()
    const pendingSecond = apiFetch<{ starts: number }>('/api/v1/seasons', {
      dedupeKey: 'seasons',
      signal: second.signal,
      timeoutMs: 30_000,
    })

    await vi.advanceTimersByTimeAsync(50)
    await expect(pendingSecond).resolves.toEqual({ starts: 2 })
    expect(starts).toBe(2)
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
