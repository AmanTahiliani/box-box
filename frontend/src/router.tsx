import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { Nav } from './components/Nav'
import { CommandCenterPage } from './pages/CommandCenterPage'
import { RaceHubPage } from './pages/RaceHubPage'
import { DataLibraryPage } from './pages/DataLibraryPage'
import { LiveTimingPage } from './pages/LiveTimingPage'
import { BriefingPage } from './pages/BriefingPage'
import { ChampionshipPage } from './pages/ChampionshipPage'
import { DriverProfilePage } from './pages/DriverProfilePage'
import { RacePreviewPage } from './pages/RacePreviewPage'

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
      <main>
        <Outlet />
      </main>
    </>
  ),
})

export const commandCenterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: CommandCenterPage,
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

export const previewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/preview',
  component: RacePreviewPage,
})

const routeTree = rootRoute.addChildren([
  commandCenterRoute,
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
