import { Link } from '@tanstack/react-router'

export function WeekendLoading() {
  return (
    <div className="wk-status wk-status-loading" data-testid="weekend-loading" aria-busy="true">
      <span className="wk-status-eyebrow mono">box-box · weekend</span>
      <p className="wk-status-title">Reading the weekend…</p>
    </div>
  )
}

export function WeekendError({ message }: { message?: string }) {
  return (
    <div className="wk-status wk-status-error" data-testid="weekend-error" role="alert">
      <span className="wk-status-eyebrow mono">box-box · weekend</span>
      <p className="wk-status-title">Weekend unavailable</p>
      <p className="wk-status-sub">{message ?? 'Something went wrong loading the weekend context.'}</p>
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
