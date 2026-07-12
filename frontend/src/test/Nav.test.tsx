import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
} from '@tanstack/react-router'
import { Nav } from '../components/Nav'

function renderNav() {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Nav />
        <Outlet />
      </>
    ),
  })
  const stub = (p: string, id: string) =>
    createRoute({ getParentRoute: () => rootRoute, path: p, component: () => <div data-testid={id} /> })
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      stub('/', 'home'),
      stub('/championship', 'championship'),
      stub('/briefing', 'briefing'),
      stub('/explore', 'explore'),
      stub('/admin', 'admin'),
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

const DESTINATIONS = ['Weekend', 'Championship', 'Briefing', 'Explore']

describe('Nav — one primary navigation system per breakpoint', () => {
  it('exposes exactly two Primary landmarks (one per breakpoint), never more', async () => {
    renderNav()
    await waitFor(() => expect(screen.getAllByRole('navigation', { name: 'Primary' })).toHaveLength(2))
  })

  it('every Primary landmark contains all four destinations', async () => {
    renderNav()
    await waitFor(() => expect(screen.getAllByRole('navigation', { name: 'Primary' }).length).toBe(2))
    const primaries = screen.getAllByRole('navigation', { name: 'Primary' })
    for (const nav of primaries) {
      for (const label of DESTINATIONS) {
        expect(within(nav).getByRole('link', { name: new RegExp(`^${label}$`) })).toBeInTheDocument()
      }
    }
  })

  it('keeps Admin out of every Primary landmark (operator utility only)', async () => {
    renderNav()
    await waitFor(() => expect(screen.getAllByRole('navigation', { name: 'Primary' }).length).toBe(2))
    const primaries = screen.getAllByRole('navigation', { name: 'Primary' })
    for (const nav of primaries) {
      expect(within(nav).queryByRole('link', { name: /Admin/i })).not.toBeInTheDocument()
    }
    // Admin lives in the operator utilities toolbar.
    const toolbar = screen.getByRole('toolbar', { name: 'Operator utilities' })
    expect(within(toolbar).getByRole('link', { name: /Admin/i })).toBeInTheDocument()
  })
})
