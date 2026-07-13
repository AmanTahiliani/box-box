import type { ReactNode } from 'react'
import { isTimeoutError, userFacingError } from '../lib/fetch'
import { noticeMessage, type DataAvailability } from '../lib/availability'

export type { DataAvailability }

export function availabilityLabel(kind: DataAvailability): string {
  switch (kind) {
    case 'local':
      return 'Local'
    case 'partial':
      return 'Partial'
    case 'stale':
      return 'Stale'
    case 'archive':
      return 'Archive'
    case 'limited':
      return 'Limited'
    case 'missing':
      return 'Missing'
  }
}

export function AvailabilityBadge({ kind, label }: { kind: DataAvailability; label?: string }) {
  return (
    <span className={`badge badge-${kind === 'archive' ? 'none' : kind}`} data-testid={`availability-${kind}`}>
      {label ?? availabilityLabel(kind)}
    </span>
  )
}

export type RouteStateKind = 'loading' | 'empty' | 'error' | 'timeout'

interface RouteStateProps {
  kind: RouteStateKind
  title?: string
  message?: ReactNode
  error?: unknown
  onRetry?: () => void
  retrying?: boolean
  testId?: string
  /** Optional override for the Retry button's data-testid (defaults to none). */
  retryTestId?: string
  className?: string
  /** Optional availability strip (stale/limited/partial) above the state body. */
  availability?: DataAvailability
  children?: ReactNode
}

const DEFAULT_TITLES: Record<RouteStateKind, string> = {
  loading: 'Loading…',
  empty: 'Nothing here yet',
  error: 'Could not load this view',
  timeout: 'Request timed out',
}

const DEFAULT_MESSAGES: Record<RouteStateKind, string> = {
  loading: 'Fetching the latest local data.',
  empty: 'No data is available for this view yet.',
  error: 'Something went wrong. Retry to try again.',
  timeout: 'This request took too long. Check your connection, then retry.',
}

/**
 * Shared primary-route state surface: loading, empty, timeout/error + retry.
 * Retry is a real <button> (keyboard accessible) and callers should gate
 * concurrent refetches via React Query / deduped apiFetch.
 */
export function RouteState({
  kind,
  title,
  message,
  error,
  onRetry,
  retrying = false,
  testId,
  retryTestId,
  className = '',
  availability,
  children,
}: RouteStateProps) {
  const resolvedKind: RouteStateKind =
    kind === 'error' && isTimeoutError(error) ? 'timeout' : kind

  const resolvedMessage =
    message ??
    (error != null && (resolvedKind === 'error' || resolvedKind === 'timeout')
      ? userFacingError(error)
      : DEFAULT_MESSAGES[resolvedKind])

  const showRetry =
    (resolvedKind === 'error' || resolvedKind === 'timeout') && typeof onRetry === 'function'

  return (
    <div
      className={`route-state route-state-${resolvedKind} ${className}`.trim()}
      data-testid={testId ?? `route-state-${resolvedKind}`}
      role={resolvedKind === 'error' || resolvedKind === 'timeout' ? 'alert' : undefined}
    >
      {availability && (
        <div className="route-state-availability">
          <AvailabilityBadge kind={availability} />
        </div>
      )}
      {resolvedKind === 'loading' ? (
        <div className="loading-state">{title ?? 'loading…'}</div>
      ) : (
        <>
          <div className="route-state-title">{title ?? DEFAULT_TITLES[resolvedKind]}</div>
          <div className="route-state-message">{resolvedMessage}</div>
          {children}
          {showRetry && (
            <button
              type="button"
              className="route-state-retry"
              onClick={onRetry}
              disabled={retrying}
              aria-busy={retrying || undefined}
              data-testid={retryTestId}
            >
              {retrying ? 'Retrying…' : 'Retry'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

interface StaleNoticeProps {
  availability?: DataAvailability
  message?: string
  onRetry?: () => void
  retrying?: boolean
  testId?: string
}

/** Inline notice when a successful payload is limited/stale/partial. */
export function DataNotice({
  availability = 'stale',
  message,
  onRetry,
  retrying = false,
  testId = 'data-notice',
}: StaleNoticeProps) {
  return (
    <div className="data-notice" data-testid={testId} role="status">
      <AvailabilityBadge kind={availability} />
      <span className="data-notice-text">{message ?? noticeMessage(availability)}</span>
      {onRetry && (
        <button
          type="button"
          className="route-state-retry data-notice-retry"
          onClick={onRetry}
          disabled={retrying}
          aria-busy={retrying || undefined}
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  )
}
