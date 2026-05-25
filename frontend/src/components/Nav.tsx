import { Link } from '@tanstack/react-router'

export function Nav() {
  return (
    <nav className="app-nav">
      <Link to="/" className="nav-logo">
        box<em>-</em>box
      </Link>
      <div className="nav-links">
        <Link to="/" activeProps={{ className: 'active' }} activeOptions={{ exact: true }}>
          Command
        </Link>
        <Link to="/race-hub" search={{}} activeProps={{ className: 'active' }}>
          Race Hub
        </Link>
        <Link to="/live" activeProps={{ className: 'active' }}>
          Live
        </Link>
        <Link to="/data-library" activeProps={{ className: 'active' }}>
          Data Library
        </Link>
      </div>
    </nav>
  )
}
