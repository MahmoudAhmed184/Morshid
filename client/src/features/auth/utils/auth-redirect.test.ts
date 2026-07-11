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
  })

  it('redirects unauthenticated users to login', () => {
    expect(getProtectedRoleRedirectPath('ADMIN')).toBe('/login')
  })

  it('defers protected route redirects until the browser can read the mock session', () => {
    const browserWindow = window

    vi.stubGlobal('window', undefined)

    try {
      expect(getProtectedRoleRedirectPath('ADMIN')).toBeNull()
    } finally {
      vi.stubGlobal('window', browserWindow)
    }
  })

  it('allows users with the expected role', () => {
    useAuthStore.getState().setSession(createMockSession('INSTRUCTOR'))

    expect(getProtectedRoleRedirectPath('INSTRUCTOR')).toBeNull()
  })

  it('redirects authenticated users with the wrong role to their route', () => {
    useAuthStore.getState().setSession(createMockSession('STUDENT'))

    expect(getProtectedRoleRedirectPath('ADMIN')).toBe('/student')
  })
})
