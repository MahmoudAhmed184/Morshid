import { create } from 'zustand'

import type { AuthSession, AuthUser } from '@/features/auth/types/auth.types'

export const authSessionStorageKey = 'morshid.auth.session'

type AuthStoreState = {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
}

type AuthStoreActions = {
  setSession: (session: AuthSession) => void
  clearSession: () => void
  logout: () => void
}

export type AuthStore = AuthStoreState & AuthStoreActions

const emptyAuthState: AuthStoreState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.email === 'string' &&
    typeof value.name === 'string' &&
    (value.role === 'admin' ||
      value.role === 'instructor' ||
      value.role === 'student')
  )
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) {
    return false
  }

  return (
    isAuthUser(value.user) &&
    typeof value.accessToken === 'string' &&
    typeof value.refreshToken === 'string'
  )
}

function getLocalStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

function readStoredSession(): AuthSession | null {
  const storage = getLocalStorage()

  if (!storage) {
    return null
  }

  const storedSession = storage.getItem(authSessionStorageKey)

  if (!storedSession) {
    return null
  }

  try {
    const parsedSession: unknown = JSON.parse(storedSession)

    return isAuthSession(parsedSession) ? parsedSession : null
  } catch {
    storage.removeItem(authSessionStorageKey)
    return null
  }
}

function persistSession(session: AuthSession) {
  getLocalStorage()?.setItem(authSessionStorageKey, JSON.stringify(session))
}

function removeStoredSession() {
  getLocalStorage()?.removeItem(authSessionStorageKey)
}

const storedSession = readStoredSession()

const initialAuthState: AuthStoreState = storedSession
  ? {
      user: storedSession.user,
      accessToken: storedSession.accessToken,
      refreshToken: storedSession.refreshToken,
      isAuthenticated: true,
    }
  : emptyAuthState

export const useAuthStore = create<AuthStore>()((set) => ({
  ...initialAuthState,
  setSession: (session) => {
    persistSession(session)
    set({
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      isAuthenticated: true,
    })
  },
  clearSession: () => {
    removeStoredSession()
    set(emptyAuthState)
  },
  logout: () => {
    removeStoredSession()
    set(emptyAuthState)
  },
}))
