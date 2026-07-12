import { Link } from '@tanstack/react-router'
import { Compass, FileText, Home, Trophy } from 'lucide-react'

const PRIMARY = [
  { to: '/', label: 'Weekend', icon: Home, exact: true },
  { to: '/championship', label: 'Championship', icon: Trophy, exact: false },
  { to: '/briefing', label: 'Briefing', icon: FileText, exact: false },
  { to: '/explore', label: 'Explore', icon: Compass, exact: false },
] as const

/**
 * Nav renders one primary navigation system per breakpoint:
 *   - Desktop/tablet: the top bar's `aria-label="Primary"` links.
 *   - Mobile (≤640px): the bottom `aria-label="Primary"` bar; the top bar's links
 *     are hidden via CSS so the two are never both active at once.
 *
 * Admin is an operator utility, deliberately outside every Primary landmark — it
 * lives in a plain toolbar slot and never appears in the mobile bottom nav.
 */
export function Nav() {
  return (
    <>
      <header className="app-nav">
        <Link to="/" className="nav-logo">
          box<em>-</em>box
        </Link>
        <nav className="nav-links" aria-label="Primary">
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
        </nav>
        <div className="nav-utility" role="toolbar" aria-label="Operator utilities">
          <Link
            to="/admin"
            className="nav-utility-link"
            activeProps={{ className: 'nav-utility-link active' }}
          >
            Admin
          </Link>
        </div>
      </header>

      <nav className="app-bottom-nav" aria-label="Primary">
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
