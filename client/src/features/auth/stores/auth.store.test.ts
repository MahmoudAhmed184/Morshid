import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AuthSession } from '@/features/auth/types/auth.types'

import { authSessionStorageKey, useAuthStore } from './auth.store'

const mockSession: AuthSession = {
  user: {
    id: 'mock-instructor',
    email: 'instructor@morshid.demo',
    displayName: 'Demo Instructor',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    courses: [],
  },
  tokenType: 'Bearer',
  accessToken: 'mock-access-token:mock-instructor',
  accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
  refreshToken: 'mock-refresh-token:mock-instructor',
  refreshTokenExpiresAt: '2026-07-18T12:00:00.000Z',
}

function resetAuthStore() {
  useAuthStore.getState().clearSession()
}

describe('useAuthStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetAuthStore()
  })

  afterEach(() => {
    resetAuthStore()
    window.localStorage.clear()
  })

  it('starts without an authenticated session', () => {
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    })
  })

  it('sets and persists the current auth session', () => {
    useAuthStore.getState().setSession(mockSession)

    expect(useAuthStore.getState()).toMatchObject({
      user: mockSession.user,
      accessToken: mockSession.accessToken,
      refreshToken: mockSession.refreshToken,
      isAuthenticated: true,
    })
    expect(window.localStorage.getItem(authSessionStorageKey)).toBe(
      JSON.stringify(mockSession),
    )
  })

  it('updates and persists the current user without changing tokens', () => {
    const updatedUser = {
      ...mockSession.user,
      displayName: 'Updated Instructor',
      courses: [
        {
          id: 'course-1',
          code: 'PYTHON-PROG-P0',
          title: 'Python Programming',
          membershipRole: 'INSTRUCTOR' as const,
        },
      ],
    }

    useAuthStore.getState().setSession(mockSession)
    useAuthStore.getState().setUser(updatedUser)

    expect(useAuthStore.getState()).toMatchObject({
      user: updatedUser,
      accessToken: mockSession.accessToken,
      refreshToken: mockSession.refreshToken,
      isAuthenticated: true,
    })
    expect(window.localStorage.getItem(authSessionStorageKey)).toBe(
      JSON.stringify({
        ...mockSession,
        user: updatedUser,
      }),
    )
  })

  it('clears the current auth session and persisted storage', () => {
    useAuthStore.getState().setSession(mockSession)

    useAuthStore.getState().clearSession()

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    })
    expect(window.localStorage.getItem(authSessionStorageKey)).toBeNull()
  })

  it('logs out by clearing the current auth session and persisted storage', () => {
    useAuthStore.getState().setSession(mockSession)

    useAuthStore.getState().logout()

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    })
    expect(window.localStorage.getItem(authSessionStorageKey)).toBeNull()
  })
})
