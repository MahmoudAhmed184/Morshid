import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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
      name: `Demo ${role}`,
      role,
    },
    accessToken: `mock-access-token:${role}`,
    refreshToken: `mock-refresh-token:${role}`,
  }
}

describe('getAuthRedirectPath', () => {
  it.each([
    ['admin', '/admin'],
    ['instructor', '/instructor'],
    ['student', '/student'],
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
    expect(getProtectedRoleRedirectPath('admin')).toBe('/login')
  })

  it('allows users with the expected role', () => {
    useAuthStore.getState().setSession(createMockSession('instructor'))

    expect(getProtectedRoleRedirectPath('instructor')).toBeNull()
  })

  it('redirects authenticated users with the wrong role to their route', () => {
    useAuthStore.getState().setSession(createMockSession('student'))

    expect(getProtectedRoleRedirectPath('admin')).toBe('/student')
  })
})
