import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { Nav } from './components/Nav'
import { WeekendPage } from './pages/WeekendPage'
import { ExplorePage } from './pages/ExplorePage'
import { RaceHubPage } from './pages/RaceHubPage'
import { DataLibraryPage } from './pages/DataLibraryPage'
import { LiveTimingPage } from './pages/LiveTimingPage'
import { BriefingPage } from './pages/BriefingPage'
import { ChampionshipPage } from './pages/ChampionshipPage'
import { DriverProfilePage } from './pages/DriverProfilePage'
import { parseRaceHubSearch, parseWeekendSearch } from './lib/routeSearch'

type DriverProfileSearch = {
  year?: number
}

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Nav />
      <Outlet />
    </>
  ),
})

// Weekend is the adaptive home. `/` renders the current temporal state.
// Optional meeting_key/session_key search restores Race Hub return context
// (deep-linkable, reload-safe — no hidden component memory).
export const weekendRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>) => parseWeekendSearch(search),
  component: function WeekendRoute() {
    const { meeting_key, session_key } = weekendRoute.useSearch()
    return (
      <WeekendPage focusMeetingKey={meeting_key} focusSessionKey={session_key} />
    )
  },
})

export const exploreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore',
  component: ExplorePage,
})

export const raceHubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/race-hub',
  validateSearch: (search: Record<string, unknown>) => parseRaceHubSearch(search),
  component: function RaceHubRoute() {
    const { session_key } = raceHubRoute.useSearch()
    return <RaceHubPage sessionKey={session_key ?? 0} />
  },
})

export const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: DataLibraryPage,
})

// Legacy alias — kept so any saved /data-library links keep working.
export const dataLibraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/data-library',
  component: DataLibraryPage,
})

export const liveTimingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/live',
  component: LiveTimingPage,
})

export const championshipRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/championship',
  component: ChampionshipPage,
})

export const driverProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/drivers/$driverNumber',
  validateSearch: (search: Record<string, unknown>): DriverProfileSearch => {
    const year = Number(search.year)
    return Number.isFinite(year) && year > 0 ? { year } : {}
  },
  component: function DriverProfileRoute() {
    const { driverNumber } = driverProfileRoute.useParams()
    const { year } = driverProfileRoute.useSearch()
    return <DriverProfilePage driverNumber={Number(driverNumber) || 0} year={year} />
  },
})

export const briefingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/briefing',
  component: BriefingPage,
})

// Preview folds into the Weekend home. /preview is a stable alias that renders the
// Weekend page in its preparation surface (PreSessionView) whenever there is a next
// event — so saved preview links and the "Prepare for …" CTA reach real preview
// content instead of redirecting back to the same between-races screen.
export const previewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/preview',
  component: function PreviewRoute() {
    return <WeekendPage preview />
  },
})

const routeTree = rootRoute.addChildren([
  weekendRoute,
  exploreRoute,
  raceHubRoute,
  adminRoute,
  dataLibraryRoute,
  liveTimingRoute,
  championshipRoute,
  driverProfileRoute,
  briefingRoute,
  previewRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
