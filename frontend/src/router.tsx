import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { Nav } from './components/Nav'
import { RaceHubPage } from './pages/RaceHubPage'
import { DataLibraryPage } from './pages/DataLibraryPage'
import { LiveTimingPage } from './pages/LiveTimingPage'

type RaceHubSearch = {
  session_key?: number
}

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Nav />
      <Outlet />
    </>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/race-hub', search: {} })
  },
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

const routeTree = rootRoute.addChildren([indexRoute, raceHubRoute, dataLibraryRoute, liveTimingRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
