import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

const storedMockSession = {
  v: 1,
  user: mockSession.user,
  accessToken: mockSession.accessToken,
  accessTokenExpiresAt: mockSession.accessTokenExpiresAt,
  refreshToken: mockSession.refreshToken,
  refreshTokenExpiresAt: mockSession.refreshTokenExpiresAt,
}

function resetAuthStore() {
  useAuthStore.getState().clearSession()
}

async function importFreshAuthStore() {
  vi.resetModules()

  return import('./auth.store')
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
      JSON.stringify(storedMockSession),
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
        ...storedMockSession,
        user: updatedUser,
      }),
    )
  })

  it('hydrates a valid versioned stored session', async () => {
    window.localStorage.setItem(
      authSessionStorageKey,
      JSON.stringify(storedMockSession),
    )

    const { useAuthStore: useFreshAuthStore } = await importFreshAuthStore()

    expect(useFreshAuthStore.getState()).toMatchObject({
      user: mockSession.user,
      tokenType: 'Bearer',
      accessToken: mockSession.accessToken,
      refreshToken: mockSession.refreshToken,
      isAuthenticated: true,
    })
  })

  it('clears legacy unversioned stored sessions', async () => {
    window.localStorage.setItem(
      authSessionStorageKey,
      JSON.stringify(mockSession),
    )

    const { useAuthStore: useFreshAuthStore } = await importFreshAuthStore()

    expect(useFreshAuthStore.getState().isAuthenticated).toBe(false)
    expect(window.localStorage.getItem(authSessionStorageKey)).toBeNull()
  })

  it('clears stored sessions after the refresh token expires', async () => {
    window.localStorage.setItem(
      authSessionStorageKey,
      JSON.stringify({
        ...storedMockSession,
        refreshTokenExpiresAt: '2000-01-01T00:00:00.000Z',
      }),
    )

    const { useAuthStore: useFreshAuthStore } = await importFreshAuthStore()

    expect(useFreshAuthStore.getState().isAuthenticated).toBe(false)
    expect(window.localStorage.getItem(authSessionStorageKey)).toBeNull()
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
