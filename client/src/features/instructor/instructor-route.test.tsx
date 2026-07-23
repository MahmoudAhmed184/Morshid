import '@testing-library/jest-dom/vitest'
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession, AuthUser } from '@/features/auth/schemas/auth.schema'
import { InstructorRoutePending } from '@/features/instructor/components/instructor-route-pending'
import { routeTree } from '@/routeTree.gen'
import { getAppQueryClient } from '@/lib/query/query-client'

vi.mock('@tanstack/react-devtools', () => ({ TanStackDevtools: () => null }))
vi.mock('@tanstack/react-router-devtools', () => ({
  TanStackRouterDevtoolsPanel: () => null,
}))

function createSession(role: AuthUser['role']): AuthSession {
  const roleSlug = role.toLowerCase()

  return {
    user: {
      id: `${roleSlug}-id`,
      email: `${roleSlug}@morshid.demo`,
      displayName: `Demo ${role}`,
      role,
      status: 'ACTIVE',
      courses:
        role === 'INSTRUCTOR'
          ? [
              {
                id: 'f5bb713c-09b7-42d3-acf3-02f39a902e5a',
                code: 'PYTHON-PROG-P0',
                title: 'Python Programming',
                membershipRole: 'INSTRUCTOR',
              },
            ]
          : [],
    },
    tokenType: 'Bearer',
    accessToken: `${roleSlug}-access-token`,
    accessTokenExpiresAt: '2027-07-11T12:15:00.000Z',
    refreshToken: `${roleSlug}-refresh-token`,
    refreshTokenExpiresAt: '2027-07-18T12:00:00.000Z',
  }
}

function renderAtInstructorRoute(
  session: AuthSession,
  coursesResponse?: Promise<Response>,
) {
  useAuthStore.getState().setSession(session)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/api/v1/me')) {
        return Response.json({ user: session.user }, { status: 200 })
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

      if (url.endsWith('/api/v1/courses/material-management')) {
        return (
          coursesResponse ??
          Response.json({
            courses: session.user.courses.map(({ id, code, title }) => ({
              id,
              code,
              title,
              membershipRole: 'INSTRUCTOR',
              canManageMaterials: true,
            })),
          })
        )
      }

      if (url.endsWith('/api/v1/courses')) {
        return Response.json({ courses: session.user.courses })
      }

      if (
        url.endsWith(
          '/api/v1/courses/f5bb713c-09b7-42d3-acf3-02f39a902e5a/materials',
        )
      ) {
        return Response.json({
          materials: [
            {
              id: '3e533215-42ba-42b8-ad6a-404e7bb3c8d7',
              courseId: 'f5bb713c-09b7-42d3-acf3-02f39a902e5a',
              title: 'Course source',
              originalFilename: 'course-source.pdf',
              status: 'READY',
              extractedTextLength: 1_200,
              chunkCount: 2,
              errorMessage: null,
              createdAt: '2026-07-21T12:00:00.000Z',
              updatedAt: '2026-07-21T12:01:00.000Z',
            },
          ],
        })
      }

      throw new Error(`Unexpected request: ${url}`)
    }),
  )

  const history = createMemoryHistory({ initialEntries: ['/instructor'] })
  const router = createRouter({ routeTree, history })

  render(<RouterProvider router={router} />)

  return { history }
}

function renderUnauthenticatedAtInstructorRoute() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json(
        { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' },
        { status: 401 },
      ),
    ),
  )

  const history = createMemoryHistory({ initialEntries: ['/instructor'] })
  const router = createRouter({ routeTree, history })

  render(<RouterProvider router={router} />)

  return { history }
}

describe('/instructor', () => {
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
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    cleanup()
    getAppQueryClient().clear()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  it('renders the Instructor dashboard for an Instructor session', async () => {
    const { history } = renderAtInstructorRoute(createSession('INSTRUCTOR'))

    expect(
      await screen.findByRole('heading', { name: "Today's teaching desk." }),
    ).toBeVisible()
    expect(await screen.findByText('Python Programming')).toBeVisible()
    expect(history.location.pathname).toBe('/instructor')
    expect(document.querySelector('a[href="/admin"]')).toBeNull()
    expect(
      screen.queryByRole('button', { name: /manage users/i }),
    ).not.toBeInTheDocument()
  })

  it('redirects a Student session to the Student shell', async () => {
    const { history } = renderAtInstructorRoute(createSession('STUDENT'))

    await waitFor(() => expect(history.location.pathname).toBe('/courses'))
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: "Today's teaching desk." }),
      ).not.toBeInTheDocument(),
    )
  })

  it('shows the route empty state when the Instructor has no manageable course', async () => {
    const session = createSession('INSTRUCTOR')
    session.user.courses = []

    renderAtInstructorRoute(session)

    expect(
      await screen.findByRole('heading', { name: 'No assigned course' }),
    ).toBeVisible()
    expect(screen.queryByText('Python Programming')).not.toBeInTheDocument()
  })

  it('shows AuthLoader while authentication is being resolved', () => {
    useAuthStore.getState().clearSession()

    render(<InstructorRoutePending />)

    expect(screen.getByLabelText('Checking authentication')).toBeVisible()
    expect(screen.queryByText('Instructor Portal')).not.toBeInTheDocument()
  })

  it('shows dashboard loading while manageable courses are requested', async () => {
    renderAtInstructorRoute(
      createSession('INSTRUCTOR'),
      new Promise<Response>(() => undefined),
    )

    expect(
      await screen.findByRole('status', {
        name: 'Loading instructor dashboard',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Source readiness' }),
    ).toBeVisible()
    expect(
      screen.queryByLabelText('Checking authentication'),
    ).not.toBeInTheDocument()
  })

  it('keeps the instructor shell mounted while navigating between child routes', async () => {
    const { history } = renderAtInstructorRoute(createSession('INSTRUCTOR'))

    expect(
      await screen.findByRole('heading', { name: "Today's teaching desk." }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('link', { name: 'Review Queue' }))

    expect(
      (await screen.findAllByRole('heading', { name: 'Review Queue' })).length,
    ).toBeGreaterThanOrEqual(1)
    expect(history.location.pathname).toBe('/instructor/review-queue')
    expect(
      screen.queryByLabelText('Checking authentication'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Materials' }))

    await waitFor(() => {
      expect(history.location.pathname).toBe('/instructor/materials')
    })
    expect(
      await screen.findByRole('heading', { name: 'Course Materials' }),
    ).toBeVisible()
    expect(
      screen.queryByLabelText('Checking authentication'),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }))

    expect(
      await screen.findByRole('heading', { name: "Today's teaching desk." }),
    ).toBeVisible()
    expect(history.location.pathname).toBe('/instructor')
    expect(
      screen.getByRole('navigation', { name: 'Breadcrumb' }),
    ).toHaveTextContent('Instructor')
  })

  it('redirects an Admin session to the Admin shell', async () => {
    const { history } = renderAtInstructorRoute(createSession('ADMIN'))

    await waitFor(() => expect(history.location.pathname).toBe('/admin'))
    expect(
      await screen.findByRole('navigation', { name: 'Breadcrumb' }),
    ).toHaveTextContent('Admin')
  })

  it('redirects an unauthenticated browser session to sign in', async () => {
    const { history } = renderUnauthenticatedAtInstructorRoute()

    await waitFor(() => expect(history.location.pathname).toBe('/login'))
    expect(
      await screen.findByRole('heading', { name: 'Welcome back.' }),
    ).toBeVisible()
  })

  it('navigates from landing through sign-in to the Instructor shell', async () => {
    const session = createSession('INSTRUCTOR')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)

        if (url.endsWith('/api/v1/auth/refresh')) {
          return Response.json(
            {
              code: 'INVALID_REFRESH_TOKEN',
              message: 'Invalid refresh token',
            },
            { status: 401 },
          )
        }

        if (url.endsWith('/api/v1/auth/sign-in')) {
          return Response.json(session)
        }

        if (url.endsWith('/api/v1/me')) {
          return Response.json({ user: session.user })
        }

        if (url.endsWith('/api/v1/courses')) {
          return Response.json({ courses: session.user.courses })
        }

        throw new Error(`Unexpected request: ${url}`)
      }),
    )

    const history = createMemoryHistory({ initialEntries: ['/'] })
    const router = createRouter({ routeTree, history })
    render(<RouterProvider router={router} />)

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Begin studying' }))[0],
    )
    expect(
      await screen.findByRole('heading', { name: 'Welcome back.' }),
    ).toBeVisible()

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Institutional Email' }),
      { target: { value: 'instructor@morshid.demo' } },
    )
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'MorshidDemoP0!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(
      await screen.findByRole('heading', { name: "Today's teaching desk." }),
    ).toBeVisible()
    expect(history.location.pathname).toBe('/instructor')
  })
})
