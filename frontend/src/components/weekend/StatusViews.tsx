import { Link } from '@tanstack/react-router'
import { userFacingError } from '../../lib/fetch'

export function WeekendLoading() {
  return (
    <div className="wk-status wk-status-loading" data-testid="weekend-loading" aria-busy="true">
      <span className="wk-status-eyebrow mono">box-box · weekend</span>
      <p className="wk-status-title">Reading the weekend…</p>
    </div>
  )
}

export function WeekendError({
  error,
  message,
  onRetry,
  retrying = false,
}: {
  error?: unknown
  message?: string
  onRetry?: () => void
  retrying?: boolean
}) {
  const resolved =
    message ??
    (error != null ? userFacingError(error) : 'Something went wrong loading the weekend context.')

  return (
    <div className="wk-status wk-status-error" data-testid="weekend-error" role="alert">
      <span className="wk-status-eyebrow mono">box-box · weekend</span>
      <p className="wk-status-title">Weekend unavailable</p>
      <p className="wk-status-sub">{resolved}</p>
      {typeof onRetry === 'function' && (
        <div className="wk-status-actions">
          <button
            type="button"
            className="wk-cta wk-cta-primary"
            onClick={onRetry}
            disabled={retrying}
            aria-busy={retrying || undefined}
            data-testid="weekend-retry"
          >
            {retrying ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}
    </div>
  )
}

export function WeekendLimited({ message, season }: { message?: string; season?: number }) {
  return (
    <div className="wk-status wk-status-limited" data-testid="weekend-limited">
      <span className="wk-status-eyebrow mono">box-box · weekend</span>
      <p className="wk-status-title">Nothing to show yet</p>
      <p className="wk-status-sub">
        {message ?? `No weekend data for the ${season || 'current'} season is available right now.`}
      </p>
      <div className="wk-status-actions">
        <Link to="/live" className="wk-cta wk-cta-ghost">Live timing</Link>
        <Link to="/explore" className="wk-cta wk-cta-ghost">Explore</Link>
      </div>
    </div>
  )
}
