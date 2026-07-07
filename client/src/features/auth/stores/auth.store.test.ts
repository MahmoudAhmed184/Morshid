import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AuthSession } from '@/features/auth/types/auth.types'

import { authSessionStorageKey, useAuthStore } from './auth.store'

const mockSession: AuthSession = {
  user: {
    id: 'mock-instructor',
    email: 'instructor@morshid.demo',
    name: 'Demo Instructor',
    role: 'instructor',
  },
  accessToken: 'mock-access-token:mock-instructor',
  refreshToken: 'mock-refresh-token:mock-instructor',
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
})
