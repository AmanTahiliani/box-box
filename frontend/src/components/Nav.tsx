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
        <Link to="/live" activeProps={{ className: 'active' }}>
          Live
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
