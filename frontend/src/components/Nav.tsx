import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { fetchLiveState } from '../api'
import { isLiveSessionActive } from '../lib/live'

export function Nav() {
  const { data: liveState } = useQuery({
    queryKey: ['live-state'],
    queryFn: fetchLiveState,
    staleTime: 5_000,
    refetchInterval: 30_000,
  })
  const liveActive = isLiveSessionActive(liveState)

  return (
    <nav className="app-nav">
      <Link to="/" className="nav-logo">
        box<em>-</em>box
      </Link>
      <div className="nav-links">
        <Link to="/" activeProps={{ className: 'active' }} activeOptions={{ exact: true }}>
          Command
        </Link>
        <Link
          to="/live"
          className={liveActive ? 'nav-live nav-live-on' : 'nav-live'}
          activeProps={{ className: 'active' }}
          data-testid="nav-live"
          data-live-active={liveActive ? 'true' : 'false'}
        >
          {liveActive && <span className="nav-live-dot" aria-hidden="true" />}
          Live
          {liveActive && <span className="sr-only"> session active</span>}
        </Link>
        <Link to="/race-hub" search={{}} activeProps={{ className: 'active' }}>
          Race Hub
        </Link>
        <Link to="/preview" activeProps={{ className: 'active' }}>
          Preview
        </Link>
        <Link to="/championship" activeProps={{ className: 'active' }}>
          Championship
        </Link>
        <Link to="/briefing" activeProps={{ className: 'active' }}>
          Briefing
        </Link>
      </div>
      <div className="nav-utility">
        <Link to="/admin" className="nav-utility-link" activeProps={{ className: 'nav-utility-link active' }}>
          Admin
        </Link>
      </div>
    </nav>
  )
}
