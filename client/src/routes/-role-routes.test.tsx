import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthRole, AuthSession } from '@/features/auth/types/auth.types'
import { routeTree } from '@/routeTree.gen'

function createSession(role: AuthRole): AuthSession {
  return {
    tokenType: 'Bearer',
    user: {
      id: `${role.toLowerCase()}-user`,
      email: `${role.toLowerCase()}@morshid.demo`,
      displayName: `${role} User`,
      role,
      status: 'ACTIVE',
      courses: [],
    },
    accessToken: `${role.toLowerCase()}-access-token`,
    accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
    refreshToken: `${role.toLowerCase()}-refresh-token`,
    refreshTokenExpiresAt: '2026-07-18T12:00:00.000Z',
  }
}

async function loadRoute(path: string) {
  const history = createMemoryHistory({ initialEntries: [path] })
  const router = createRouter({ routeTree, history })

  await router.load()

  return router.state.location.pathname
}

describe('role route boundaries', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('redirects an anonymous student-route visit to login', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      Response.json(
        { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' },
        { status: 401 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadRoute('/chat')).resolves.toBe('/login')
    expect(fetchMock).toHaveBeenCalled()
    expect(
      fetchMock.mock.calls.every(([input]) =>
        String(input).endsWith('/api/v1/auth/refresh'),
      ),
    ).toBe(true)
  })

  it('redirects an admin away from the student route tree', async () => {
    const session = createSession('ADMIN')
    useAuthStore.getState().setSession(session)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ user: session.user })),
    )

    await expect(loadRoute('/chat')).resolves.toBe('/admin')
    await expect(loadRoute('/settings')).resolves.toBe('/admin')
  })

  it('redirects a student away from the admin route tree', async () => {
    const session = createSession('STUDENT')
    useAuthStore.getState().setSession(session)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith('/api/v1/courses')
          ? Response.json({ courses: [] })
          : Response.json({ user: session.user }),
      ),
    )

    await expect(loadRoute('/admin')).resolves.toBe('/chat')
  })

  // Spec finding 5 — the redesign retired the student course library and the
  // instructor My Courses page. Both deep links must still resolve rather than
  // dead-end, and they must do so in `beforeLoad`: a component-level redirect
  // would let the destination's loaders run first (the admin loaders throw for
  // a non-Admin, turning a role redirect into an error screen).
  it('keeps legacy student and instructor course links compatible', async () => {
    const studentSession = createSession('STUDENT')
    useAuthStore.getState().setSession(studentSession)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith('/api/v1/courses')
          ? Response.json({ courses: [] })
          : Response.json({ user: studentSession.user }),
      ),
    )

    await expect(loadRoute('/student/courses')).resolves.toBe('/chat')
    await expect(loadRoute('/courses')).resolves.toBe('/chat')
    await expect(loadRoute('/student/ai-tutor')).resolves.toBe('/chat')

    const instructorSession = createSession('INSTRUCTOR')
    useAuthStore.getState().setSession(instructorSession)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ user: instructorSession.user })),
    )

    await expect(loadRoute('/instructor/courses')).resolves.toBe('/instructor')
  })
})
