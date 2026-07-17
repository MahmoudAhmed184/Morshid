import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/features/auth/schemas/auth.schema'

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

  it('keeps session tokens in memory without writing Web Storage', () => {
    useAuthStore.getState().setSession(mockSession)

    expect(useAuthStore.getState()).toMatchObject({
      user: mockSession.user,
      accessToken: mockSession.accessToken,
      refreshToken: mockSession.refreshToken,
      isAuthenticated: true,
    })
    expect(window.localStorage.getItem(authSessionStorageKey)).toBeNull()
    expect(window.sessionStorage.getItem(authSessionStorageKey)).toBeNull()
  })

  it('updates the current user without changing in-memory tokens', () => {
    const updatedUser = {
      ...mockSession.user,
      displayName: 'Updated Instructor',
    }

    useAuthStore.getState().setSession(mockSession)
    useAuthStore.getState().setUser(updatedUser)

    expect(useAuthStore.getState()).toMatchObject({
      user: updatedUser,
      accessToken: mockSession.accessToken,
      refreshToken: mockSession.refreshToken,
      isAuthenticated: true,
    })
    expect(window.localStorage.getItem(authSessionStorageKey)).toBeNull()
  })

  it('removes legacy persisted tokens instead of hydrating them', async () => {
    window.localStorage.setItem(
      authSessionStorageKey,
      JSON.stringify({ refreshToken: mockSession.refreshToken }),
    )
    vi.resetModules()

    const { useAuthStore: freshAuthStore } = await import('./auth.store')

    expect(freshAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    })
    expect(window.localStorage.getItem(authSessionStorageKey)).toBeNull()
  })

  it('clears the current in-memory auth session', () => {
    useAuthStore.getState().setSession(mockSession)

    useAuthStore.getState().clearSession()

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    })
  })

  it('does not let stale work clear a newer session version', () => {
    useAuthStore.getState().setSession(mockSession)
    const staleVersion = useAuthStore.getState().sessionVersion

    useAuthStore.getState().setSession({
      ...mockSession,
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    })

    expect(useAuthStore.getState().clearSession(staleVersion)).toBe(false)
    expect(useAuthStore.getState().accessToken).toBe('new-access-token')
  })
})
