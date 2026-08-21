import '@testing-library/jest-dom/vitest'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NavigationScrollReset } from './navigation-scroll-reset'

describe('NavigationScrollReset', () => {
  const scrollToMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('scrollTo', scrollToMock)
    scrollToMock.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('resets window scroll and container scrollTop when navigating to a new route', async () => {
    const rootRoute = createRootRoute({
      component: () => (
        <div>
          <NavigationScrollReset />
          <main data-slot="sidebar-inset" className="overflow-y-auto">
            <Outlet />
          </main>
        </div>
      ),
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <div>Page 1</div>,
    })

    const secondRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/second',
      component: () => <div>Page 2</div>,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, secondRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Page 1')).toBeInTheDocument()

    const container = document.querySelector(
      '[data-slot="sidebar-inset"]',
    ) as HTMLElement
    expect(container).not.toBeNull()
    container.scrollTop = 350
    container.scrollLeft = 50

    expect(container.scrollTop).toBe(350)
    expect(container.scrollLeft).toBe(50)

    router.history.push('/second')

    expect(await screen.findByText('Page 2')).toBeInTheDocument()
    expect(scrollToMock).toHaveBeenCalledWith(0, 0)
    expect(container.scrollTop).toBe(0)
    expect(container.scrollLeft).toBe(0)
  })

  it('scrolls to hash element when hash is provided in route', async () => {
    const scrollIntoViewMock = vi.fn()

    const rootRoute = createRootRoute({
      component: () => (
        <div>
          <NavigationScrollReset />
          <main data-slot="sidebar-inset">
            <Outlet />
          </main>
        </div>
      ),
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <div>
          <div>Top Content</div>
          <section
            id="target-section"
            ref={(el) => {
              if (el) el.scrollIntoView = scrollIntoViewMock
            }}
          >
            Target Section
          </section>
        </div>
      ),
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      history: createMemoryHistory({ initialEntries: ['/#target-section'] }),
    })

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Target Section')).toBeInTheDocument()
    expect(scrollIntoViewMock).toHaveBeenCalled()
  })
})
