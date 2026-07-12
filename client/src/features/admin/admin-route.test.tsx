import '@testing-library/jest-dom/vitest'
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/features/auth/schemas/auth.schema'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { getAppQueryClient } from '@/lib/query/query-client'
import { routeTree } from '@/routeTree.gen'

vi.mock('@tanstack/react-devtools', () => ({ TanStackDevtools: () => null }))
vi.mock('@tanstack/react-router-devtools', () => ({
  TanStackRouterDevtoolsPanel: () => null,
}))

const adminSession: AuthSession = {
  user: {
    id: 'admin-id',
    email: 'admin@morshid.demo',
    displayName: 'Demo Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    courses: [],
  },
  tokenType: 'Bearer',
  accessToken: 'admin-access-token',
  accessTokenExpiresAt: '2027-07-11T12:15:00.000Z',
  refreshToken: 'admin-refresh-token',
  refreshTokenExpiresAt: '2027-07-18T12:00:00.000Z',
}

function deferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

function emptyAdminResponse(url: string) {
  if (url.endsWith('/api/v1/me')) {
    return Response.json({ user: adminSession.user })
  }

  if (url.includes('/api/v1/admin/users?')) {
    return Response.json({ users: [] })
  }

  if (url.endsWith('/api/v1/admin/courses')) {
    return Response.json({ courses: [] })
  }

  if (url.includes('/api/v1/admin/audit?')) {
    return Response.json({ events: [] })
  }

  throw new Error(`Unexpected request: ${url}`)
}

function renderAdminRoute(path: string) {
  const history = createMemoryHistory({ initialEntries: [path] })
  const router = createRouter({ routeTree, history })
  render(<RouterProvider router={router} />)

  return { history }
}

describe('Admin routes', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    vi.stubGlobal('scrollTo', vi.fn())
    useAuthStore.getState().setSession(adminSession)
  })

  afterEach(() => {
    cleanup()
    getAppQueryClient().clear()
    useAuthStore.getState().clearSession()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('waits for critical user data before rendering the users page', async () => {
    const usersResponse = deferredResponse()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.endsWith('/api/v1/me')) {
          return Response.json({ user: adminSession.user })
        }

        if (url.includes('/api/v1/admin/users?')) {
          return usersResponse.promise
        }

        throw new Error(`Unexpected request: ${url}`)
      }),
    )

    renderAdminRoute('/admin/users')

    await waitFor(() =>
      expect(
        vi
          .mocked(fetch)
          .mock.calls.some(([input]) =>
            String(input).includes('/api/v1/admin/users?'),
          ),
      ).toBe(true),
    )
    expect(
      screen.queryByRole('heading', { name: 'User Management' }),
    ).not.toBeInTheDocument()

    usersResponse.resolve(
      Response.json({ users: [], pagination: { nextCursor: null } }),
    )

    expect(
      await screen.findByRole('heading', { name: 'User Management' }),
    ).toBeVisible()
    for (const section of [
      'Dashboard',
      'Assignments',
      'Users',
      'Courses',
      'Materials',
      'Audit Logs',
    ]) {
      expect(screen.getAllByRole('link', { name: section })).toHaveLength(2)
    }
  })

  it('navigates through every required admin section', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        emptyAdminResponse(String(input)),
      ),
    )
    const { history } = renderAdminRoute('/admin/users')

    expect(
      await screen.findByRole('heading', { name: 'User Management' }),
    ).toBeVisible()

    for (const [linkName, path, heading] of [
      ['Assignments', '/admin/assignments', 'Course Assignments'],
      ['Courses', '/admin/courses', 'Course Management'],
      ['Materials', '/admin/materials', 'Material Metadata'],
      ['Audit Logs', '/admin/audit', 'Recent Audit Activity'],
      ['Dashboard', '/admin', 'No admin data found'],
    ] as const) {
      await user.click(screen.getAllByRole('link', { name: linkName })[0])
      await waitFor(() => expect(history.location.pathname).toBe(path))
      expect(
        await screen.findByRole('heading', { name: heading }),
      ).toBeVisible()
    }
  })

  it('shows a retryable route error when critical data fails', async () => {
    const user = userEvent.setup()
    let usersRequestCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.includes('/api/v1/admin/users?')) {
          usersRequestCount += 1
          if (usersRequestCount === 1) {
            return Response.json(
              { message: 'Admin users are temporarily unavailable' },
              { status: 503 },
            )
          }
        }

        return emptyAdminResponse(url)
      }),
    )
    renderAdminRoute('/admin/users')

    expect(
      await screen.findByRole('heading', { name: 'Unable to load this page' }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('heading', { name: 'User Management' }),
    ).toBeVisible()
    expect(usersRequestCount).toBe(2)
  })
})
