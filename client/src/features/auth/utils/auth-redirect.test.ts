import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthRole, AuthSession } from '@/features/auth/types/auth.types'

import {
  getAuthRedirectPath,
  getProtectedRoleRedirectPath,
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

describe('getAuthRedirectPath', () => {
  it.each([
    ['ADMIN', '/admin'],
    ['INSTRUCTOR', '/instructor'],
    ['STUDENT', '/student'],
  ] as const)('redirects %s users to %s', (role, path) => {
    expect(getAuthRedirectPath(role)).toBe(path)
  })
})

describe('getProtectedRoleRedirectPath', () => {
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

    await expect(getProtectedRoleRedirectPath('ADMIN')).resolves.toBe('/login')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('defers protected route redirects until the browser can read the stored session', async () => {
    const browserWindow = window

    vi.stubGlobal('window', undefined)

    try {
      await expect(getProtectedRoleRedirectPath('ADMIN')).resolves.toBeNull()
    } finally {
      vi.stubGlobal('window', browserWindow)
    }
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

    await expect(getProtectedRoleRedirectPath('INSTRUCTOR')).resolves.toBeNull()
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

    await expect(getProtectedRoleRedirectPath('ADMIN')).resolves.toBe(
      '/student',
    )
  })

  it('clears the stored session and redirects to login when /me fails', async () => {
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

    await expect(getProtectedRoleRedirectPath('ADMIN')).resolves.toBe('/login')
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: false,
      user: null,
    })
  })
})
