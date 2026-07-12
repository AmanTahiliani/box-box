import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { Nav } from './components/Nav'
import { WeekendPage } from './pages/WeekendPage'
import { ExplorePage } from './pages/ExplorePage'
import { RaceHubPage } from './pages/RaceHubPage'
import { DataLibraryPage } from './pages/DataLibraryPage'
import { LiveTimingPage } from './pages/LiveTimingPage'
import { BriefingPage } from './pages/BriefingPage'
import { ChampionshipPage } from './pages/ChampionshipPage'
import { DriverProfilePage } from './pages/DriverProfilePage'

type RaceHubSearch = {
  session_key?: number
}

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
export const weekendRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: WeekendPage,
})

export const exploreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore',
  component: ExplorePage,
})

export const raceHubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/race-hub',
  validateSearch: (search: Record<string, unknown>): RaceHubSearch => {
    const sessionKey = Number(search.session_key)
    return Number.isFinite(sessionKey) && sessionKey > 0 ? { session_key: sessionKey } : {}
  },
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

// Preview folds into the Weekend home. Keep /preview as a stable redirect so saved
// links resolve into the appropriate Weekend state.
export const previewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/preview',
  beforeLoad: () => {
    throw redirect({ to: '/' })
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
