import { Link } from '@tanstack/react-router'
import { Compass, FileText, Home, Trophy } from 'lucide-react'

const PRIMARY = [
  { to: '/', label: 'Weekend', icon: Home, exact: true },
  { to: '/championship', label: 'Championship', icon: Trophy, exact: false },
  { to: '/briefing', label: 'Briefing', icon: FileText, exact: false },
  { to: '/explore', label: 'Explore', icon: Compass, exact: false },
] as const

export function Nav() {
  return (
    <>
      <nav className="app-nav" aria-label="Primary">
        <Link to="/" className="nav-logo">
          box<em>-</em>box
        </Link>
        <div className="nav-links">
          {PRIMARY.map(({ to, label, exact }) => (
            <Link
              key={to}
              to={to}
              activeProps={{ className: 'active' }}
              activeOptions={exact ? { exact: true } : undefined}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="nav-utility">
          <Link
            to="/admin"
            className="nav-utility-link"
            activeProps={{ className: 'nav-utility-link active' }}
          >
            Admin
          </Link>
        </div>
      </nav>

      <nav className="app-bottom-nav" aria-label="Primary mobile">
        {PRIMARY.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            className="bottom-nav-link"
            activeProps={{ className: 'bottom-nav-link active' }}
            activeOptions={exact ? { exact: true } : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
