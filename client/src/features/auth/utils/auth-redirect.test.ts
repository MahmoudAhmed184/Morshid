import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthRole, AuthSession } from '@/features/auth/schemas/auth.schema'

import {
  getDashboardPath,
  redirectAuthenticatedToDashboard,
  requireAuth,
  requireRole,
} from './auth-redirect'

function createMockSession(role: AuthRole): AuthSession {
  return {
    user: {
      id: `mock-${role}`,
      email: `${role}@morshid.demo`,
      displayName: `Demo ${role}`,
      role,
      status: 'ACTIVE',
      courses: [],
    },
    tokenType: 'Bearer',
    accessToken: `mock-access-token:${role}`,
    accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
    refreshToken: `mock-refresh-token:${role}`,
    refreshTokenExpiresAt: '2026-07-18T12:00:00.000Z',
  }
}

describe('getDashboardPath', () => {
  it.each([
    ['ADMIN', '/admin'],
    ['INSTRUCTOR', '/instructor'],
    ['STUDENT', '/courses'],
  ] as const)('redirects %s users to %s', (role, path) => {
    expect(getDashboardPath(role)).toBe(path)
  })
})

describe('client auth guards', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    window.sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('redirects unauthenticated users when no cookie session can be restored', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' },
        { status: 401 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(requireAuth()).resolves.toBe('/login')
    await expect(requireRole('ADMIN')).resolves.toBe('/login')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('defers guards until the browser can read the stored session', async () => {
    const browserWindow = window

    vi.stubGlobal('window', undefined)

    try {
      await expect(requireAuth()).resolves.toBeNull()
      await expect(requireRole('ADMIN')).resolves.toBeNull()
      await expect(redirectAuthenticatedToDashboard()).resolves.toBeNull()
    } finally {
      vi.stubGlobal('window', browserWindow)
    }
  })

  it('allows authenticated users when /me succeeds', async () => {
    useAuthStore.getState().setSession(createMockSession('ADMIN'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          user: createMockSession('ADMIN').user,
        }),
      ),
    )

    await expect(requireAuth()).resolves.toBeNull()
  })

  it('restores an in-memory access token from the HttpOnly cookie session', async () => {
    const session = createMockSession('ADMIN')
    const restoredSession = {
      ...session,
      accessToken: 'restored-access-token',
      refreshToken: 'rotated-refresh-token',
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe('http://localhost:4000/api/v1/auth/refresh')
        expect(JSON.parse(String(init?.body))).toEqual({})
        expect(init?.credentials).toBe('include')

        return Response.json(restoredSession)
      }),
    )

    await expect(requireRole('ADMIN')).resolves.toBeNull()
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'restored-access-token',
      isAuthenticated: true,
      refreshToken: 'rotated-refresh-token',
      user: session.user,
    })
    expect(window.localStorage).toHaveLength(0)
  })

  it('allows users when /me confirms the expected role', async () => {
    const session = createMockSession('INSTRUCTOR')
    const serverUser = {
      ...session.user,
      displayName: 'Server Instructor',
    }

    useAuthStore.getState().setSession(session)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          user: serverUser,
        }),
      ),
    )

    await expect(requireRole('INSTRUCTOR')).resolves.toBeNull()
    expect(useAuthStore.getState().user).toEqual(serverUser)
  })

  it('dedupes concurrent authenticated route validation requests', async () => {
    const session = createMockSession('ADMIN')
    const serverUser = {
      ...session.user,
      displayName: 'Server Admin',
    }
    const fetchMock = vi.fn(async () =>
      Response.json({
        user: serverUser,
      }),
    )

    useAuthStore.getState().setSession(session)
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      Promise.all([
        requireAuth(),
        requireRole('ADMIN'),
        redirectAuthenticatedToDashboard(),
      ]),
    ).resolves.toEqual([null, null, '/admin'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('redirects authenticated users based on the server-confirmed role', async () => {
    useAuthStore.getState().setSession(createMockSession('STUDENT'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          user: createMockSession('STUDENT').user,
        }),
      ),
    )

    await expect(requireRole('ADMIN')).resolves.toBe('/courses')
  })

  it('redirects wrong-role users away from student-only routes', async () => {
    useAuthStore.getState().setSession(createMockSession('ADMIN'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          user: createMockSession('ADMIN').user,
        }),
      ),
    )

    await expect(requireRole('STUDENT')).resolves.toBe('/admin')
  })

  it('redirects authenticated users to their dashboard when requested', async () => {
    useAuthStore.getState().setSession(createMockSession('STUDENT'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          user: createMockSession('STUDENT').user,
        }),
      ),
    )

    await expect(redirectAuthenticatedToDashboard()).resolves.toBe('/courses')
  })

  it('does not redirect unauthenticated users to a dashboard', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' },
        { status: 401 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(redirectAuthenticatedToDashboard()).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('clears the stored session and redirects to login when /me fails for a required route', async () => {
    useAuthStore.getState().setSession(createMockSession('ADMIN'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            code: 'INVALID_ACCESS_TOKEN',
            message: 'Invalid access token',
          },
          {
            status: 401,
          },
        ),
      ),
    )

    await expect(requireRole('ADMIN')).resolves.toBe('/login')
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      user: null,
    })
  })

  it('clears the stored session and redirects to login when /me fails for requireAuth', async () => {
    useAuthStore.getState().setSession(createMockSession('INSTRUCTOR'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            code: 'INVALID_ACCESS_TOKEN',
            message: 'Invalid access token',
          },
          {
            status: 401,
          },
        ),
      ),
    )

    await expect(requireAuth()).resolves.toBe('/login')
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      user: null,
    })
  })

  it('preserves the session and allows navigation when /me fails because the network is unavailable', async () => {
    const session = createMockSession('ADMIN')
    useAuthStore.getState().setSession(session)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    await expect(requireRole('ADMIN')).resolves.toBeNull()
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: session.accessToken,
      isAuthenticated: true,
      user: session.user,
    })
  })

  it('does not let a stale /me response overwrite a newer login', async () => {
    const oldSession = createMockSession('ADMIN')
    const nextSession = createMockSession('STUDENT')
    let resolveMe!: (response: Response) => void
    const meResponse = new Promise<Response>((resolve) => {
      resolveMe = resolve
    })

    useAuthStore.getState().setSession(oldSession)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => meResponse),
    )

    const guardResult = requireRole('ADMIN')
    useAuthStore.getState().setSession(nextSession)
    resolveMe(Response.json({ user: oldSession.user }))

    await expect(guardResult).resolves.toBe('/courses')
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: nextSession.accessToken,
      user: nextSession.user,
    })
  })
})
