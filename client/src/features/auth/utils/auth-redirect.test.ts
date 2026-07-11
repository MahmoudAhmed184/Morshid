import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthRole, AuthSession } from '@/features/auth/types/auth.types'

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
    ['STUDENT', '/student'],
  ] as const)('redirects %s users to %s', (role, path) => {
    expect(getDashboardPath(role)).toBe(path)
  })
})

describe('client auth guards', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('redirects unauthenticated users to login without calling /me', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(requireAuth()).resolves.toBe('/login')
    await expect(requireRole('ADMIN')).resolves.toBe('/login')
    expect(fetchMock).not.toHaveBeenCalled()
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

    await expect(requireRole('ADMIN')).resolves.toBe('/student')
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

    await expect(redirectAuthenticatedToDashboard()).resolves.toBe('/student')
  })

  it('does not redirect unauthenticated users to a dashboard', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(redirectAuthenticatedToDashboard()).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
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
})
