import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/features/auth/types/auth.types'

import {
  authSessionStorageKey,
  syncAuthRefreshFromStorage,
  useAuthStore,
} from './auth.store'

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

const persistedMockRefresh = {
  v: 2,
  userId: mockSession.user.id,
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
    window.sessionStorage.clear()
    resetAuthStore()
  })

  afterEach(() => {
    resetAuthStore()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('starts without an authenticated session', () => {
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    })
  })

  it('keeps the access token in memory and persists only refresh metadata', () => {
    useAuthStore.getState().setSession(mockSession)

    expect(useAuthStore.getState()).toMatchObject({
      user: mockSession.user,
      accessToken: mockSession.accessToken,
      refreshToken: mockSession.refreshToken,
      isAuthenticated: true,
    })
    expect(window.localStorage.getItem(authSessionStorageKey)).toBe(
      JSON.stringify(persistedMockRefresh),
    )
    expect(window.sessionStorage.getItem(authSessionStorageKey)).toBeNull()
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
      JSON.stringify(persistedMockRefresh),
    )
  })

  it('hydrates refresh metadata without restoring access or user data', async () => {
    window.localStorage.setItem(
      authSessionStorageKey,
      JSON.stringify(persistedMockRefresh),
    )

    const { useAuthStore: useFreshAuthStore } = await importFreshAuthStore()

    expect(useFreshAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: mockSession.refreshToken,
      refreshTokenUserId: mockSession.user.id,
      isAuthenticated: false,
    })
  })

  it('migrates a valid legacy full session to refresh-only storage', async () => {
    window.localStorage.setItem(
      authSessionStorageKey,
      JSON.stringify(storedMockSession),
    )

    const { useAuthStore: useFreshAuthStore } = await importFreshAuthStore()

    expect(useFreshAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: mockSession.refreshToken,
      isAuthenticated: false,
    })
    expect(window.localStorage.getItem(authSessionStorageKey)).toBe(
      JSON.stringify(persistedMockRefresh),
    )
    expect(window.sessionStorage.getItem(authSessionStorageKey)).toBeNull()
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
    expect(window.sessionStorage.getItem(authSessionStorageKey)).toBeNull()
    expect(window.localStorage.getItem(authSessionStorageKey)).toBeNull()
  })

  it('does not let stale work clear a newer session version', () => {
    useAuthStore.getState().setSession(mockSession)
    const staleVersion = useAuthStore.getState().sessionVersion
    const newerSession = {
      ...mockSession,
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }

    useAuthStore.getState().setSession(newerSession)

    expect(useAuthStore.getState().clearSession(staleVersion)).toBe(false)
    expect(useAuthStore.getState().accessToken).toBe('new-access-token')
  })

  it('synchronizes rotated refresh metadata from another tab', () => {
    useAuthStore.getState().setSession(mockSession)

    syncAuthRefreshFromStorage(
      JSON.stringify({
        ...persistedMockRefresh,
        refreshToken: 'rotated-in-another-tab',
      }),
    )

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: mockSession.accessToken,
      isAuthenticated: true,
      refreshToken: 'rotated-in-another-tab',
      user: mockSession.user,
    })
  })
})
