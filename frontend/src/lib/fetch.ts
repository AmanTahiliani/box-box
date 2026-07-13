/** Bounded fetch helpers for primary-route resilience. */

import { replaceEqualDeep } from '@tanstack/react-query'

export const DEFAULT_FETCH_TIMEOUT_MS = 15_000

/** CORS-readable success provenance headers from the Go API. */
export const DATA_SOURCE_HEADER = 'X-BoxBox-Data-Source'
export const DATA_FRESHNESS_HEADER = 'X-BoxBox-Data-Freshness'

/** Reported response source values (`openf1|local|mixed`, plus `fia` for live). */
export type DataSourceHeader = 'openf1' | 'local' | 'mixed' | 'fia' | string

/** Reported freshness (`fresh|stale|local|partial`, plus live/archive/limited). */
export type DataFreshnessHeader =
  | 'fresh'
  | 'stale'
  | 'local'
  | 'partial'
  | 'live'
  | 'archive'
  | 'limited'
  | string

/** Additive success-response availability metadata (never inferred from React Query). */
export interface ResponseAvailability {
  source?: DataSourceHeader
  freshness?: DataFreshnessHeader
}

const responseAvailability = new WeakMap<object, ResponseAvailability>()

function readHeader(headers: Headers, name: string): string | undefined {
  const value = headers.get(name)?.trim()
  return value || undefined
}

function captureResponseAvailability(data: unknown, headers: Headers): void {
  if (data === null || (typeof data !== 'object' && typeof data !== 'function')) return
  const source = readHeader(headers, DATA_SOURCE_HEADER)
  const freshness = readHeader(headers, DATA_FRESHNESS_HEADER)
  if (!source && !freshness) return
  responseAvailability.set(data as object, { source, freshness })
}

/** Read availability metadata captured from the last successful fetch of this payload. */
export function getResponseAvailability(data: unknown): ResponseAvailability | undefined {
  if (data === null || (typeof data !== 'object' && typeof data !== 'function')) return undefined
  return responseAvailability.get(data as object)
}

/** Test / manual helper — attach reported availability to a payload object. */
export function rememberResponseAvailability(
  data: object,
  meta: ResponseAvailability,
): void {
  responseAvailability.set(data, meta)
}

/** Drop availability metadata from a payload (e.g. after a header-less refetch). */
export function clearResponseAvailability(data: object): void {
  responseAvailability.delete(data)
}

/**
 * React Query structural sharing that keeps header availability in sync.
 *
 * Default `replaceEqualDeep` reuses the previous object when JSON is equal, which
 * would leave stale WeakMap metadata attached after a stale→fresh (or fresh→partial)
 * refetch of an identical body. Always re-bind the latest fetch's metadata onto the
 * object that lands in the query cache.
 */
export function availabilityAwareStructuralSharing<T>(
  oldData: T | undefined,
  newData: T,
): T {
  const meta = getResponseAvailability(newData)
  const shared = replaceEqualDeep(oldData, newData) as T
  if (shared !== null && typeof shared === 'object') {
    if (meta) {
      rememberResponseAvailability(shared as object, meta)
    } else {
      clearResponseAvailability(shared as object)
    }
  }
  return shared
}

export type ApiErrorKind = 'http' | 'timeout' | 'abort' | 'network'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly stale: boolean
  readonly userMessage: string

  constructor(
    kind: ApiErrorKind,
    message: string,
    opts?: { status?: number; stale?: boolean; userMessage?: string },
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = opts?.status
    this.stale = opts?.stale ?? false
    this.userMessage = opts?.userMessage ?? defaultUserMessage(kind, opts?.stale)
  }
}

function defaultUserMessage(kind: ApiErrorKind, stale?: boolean): string {
  if (stale) {
    return 'Showing cached data because a fresh update did not arrive. Retry to refresh.'
  }
  switch (kind) {
    case 'timeout':
      return 'This request took too long. Check your connection, then retry.'
    case 'abort':
      return 'This request was cancelled. Retry when you are ready.'
    case 'network':
      return 'Could not reach box-box. Check your connection, then retry.'
    case 'http':
    default:
      return 'Something went wrong loading this view. Retry to try again.'
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

export function isTimeoutError(err: unknown): boolean {
  return isApiError(err) && err.kind === 'timeout'
}

export function userFacingError(err: unknown): string {
  if (isApiError(err)) return err.userMessage
  if (err instanceof Error && err.message) {
    // Never surface raw "API 500: Internal Server Error" style strings.
    if (/^API\s+\d+/i.test(err.message) || /status\s+\d+/i.test(err.message)) {
      return defaultUserMessage('http')
    }
    return err.message
  }
  return defaultUserMessage('http')
}

export interface ApiFetchOptions {
  timeoutMs?: number
  signal?: AbortSignal
  /** When set, concurrent identical in-flight requests share one promise. */
  dedupeKey?: string
  method?: string
  headers?: HeadersInit
  body?: BodyInit | null
}

interface InflightEntry {
  /** Shared underlying fetch — not tied to any single caller's AbortSignal. */
  promise: Promise<unknown>
  /** Aborts the shared request only when the last subscriber cancels. */
  controller: AbortController
  subscribers: number
}

const inflight = new Map<string, InflightEntry>()

function abortError(): ApiError {
  return new ApiError('abort', 'Request aborted', {
    userMessage: defaultUserMessage('abort'),
  })
}

function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  const onAbort = () => {
    const reason = signals.find((s) => s.aborted)?.reason
    if (!controller.signal.aborted) {
      controller.abort(reason)
    }
  }
  for (const signal of signals) {
    if (signal.aborted) {
      onAbort()
      break
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }
  return controller.signal
}

async function parseErrorBody(res: Response): Promise<{ error?: string; stale?: boolean }> {
  try {
    const data = (await res.json()) as { error?: string; stale?: boolean }
    return data ?? {}
  } catch {
    return {}
  }
}

async function rawApiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  const timeoutController = new AbortController()
  const timer = setTimeout(() => {
    timeoutController.abort(new DOMException('Request timed out', 'TimeoutError'))
  }, timeoutMs)

  const signals = [timeoutController.signal]
  if (options.signal) signals.push(options.signal)
  const signal = combineAbortSignals(signals)

  try {
    let res: Response
    try {
      res = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal,
      })
    } catch (err) {
      if (timeoutController.signal.aborted && !options.signal?.aborted) {
        throw new ApiError('timeout', 'Request timed out', {
          userMessage: defaultUserMessage('timeout'),
        })
      }
      if (options.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        throw abortError()
      }
      throw new ApiError('network', err instanceof Error ? err.message : 'Network error', {
        userMessage: defaultUserMessage('network'),
      })
    }

    if (!res.ok) {
      const body = await parseErrorBody(res)
      throw new ApiError('http', body.error || `HTTP ${res.status}`, {
        status: res.status,
        stale: Boolean(body.stale),
        userMessage: body.stale
          ? defaultUserMessage('http', true)
          : defaultUserMessage('http'),
      })
    }

    const data = (await res.json()) as T
    captureResponseAvailability(data, res.headers)
    return data
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Attach a caller to a shared in-flight request.
 * One caller's abort rejects only that caller; the shared fetch continues
 * while other subscribers remain, and is cancelled only when the last one leaves.
 */
function subscribeToInflight<T>(
  key: string,
  entry: InflightEntry,
  callerSignal?: AbortSignal,
): Promise<T> {
  if (callerSignal?.aborted) {
    return Promise.reject(abortError())
  }

  entry.subscribers += 1

  return new Promise<T>((resolve, reject) => {
    let settled = false

    const leave = () => {
      entry.subscribers -= 1
      if (entry.subscribers <= 0) {
        if (!entry.controller.signal.aborted) {
          entry.controller.abort()
        }
        if (inflight.get(key) === entry) {
          inflight.delete(key)
        }
      }
    }

    const onCallerAbort = () => {
      if (settled) return
      settled = true
      leave()
      reject(abortError())
    }

    if (callerSignal) {
      callerSignal.addEventListener('abort', onCallerAbort, { once: true })
    }

    entry.promise.then(
      (value) => {
        if (settled) return
        settled = true
        callerSignal?.removeEventListener('abort', onCallerAbort)
        resolve(value as T)
      },
      (err) => {
        if (settled) return
        settled = true
        callerSignal?.removeEventListener('abort', onCallerAbort)
        reject(err)
      },
    )
  })
}

/**
 * Fetch JSON with a bounded timeout, abort propagation, typed errors,
 * and optional in-flight deduplication (same key shares one underlying request).
 *
 * Deduped requests are subscriber-safe: aborting one consumer does not cancel
 * or poison other consumers that still hold the same key (React Strict Mode remounts).
 */
export function apiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const key = options.dedupeKey
  if (!key) {
    return rawApiFetch<T>(url, options)
  }

  if (options.signal?.aborted) {
    return Promise.reject(abortError())
  }

  let entry = inflight.get(key)
  if (!entry) {
    const controller = new AbortController()
    // Shared fetch only listens to the ref-counted controller + timeout —
    // never to any single caller's AbortSignal.
    const promise = rawApiFetch<T>(url, {
      ...options,
      signal: controller.signal,
    }).finally(() => {
      if (inflight.get(key)?.promise === promise) {
        inflight.delete(key)
      }
    })
    entry = { promise, controller, subscribers: 0 }
    inflight.set(key, entry)
  }

  return subscribeToInflight<T>(key, entry, options.signal)
}

/** Test helper — clears the in-flight dedupe map. */
export function clearApiFetchInflight(): void {
  inflight.clear()
}
