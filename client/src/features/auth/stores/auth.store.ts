import { create } from 'zustand'

import type { AuthSession, AuthUser } from '@/features/auth/types/auth.types'

export const authSessionStorageKey = 'morshid.auth.session'

type AuthStoreState = {
  user: AuthUser | null
  tokenType: AuthSession['tokenType'] | null
  accessToken: string | null
  accessTokenExpiresAt: string | null
  refreshToken: string | null
  refreshTokenExpiresAt: string | null
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
  tokenType: null,
  accessToken: null,
  accessTokenExpiresAt: null,
  refreshToken: null,
  refreshTokenExpiresAt: null,
  isAuthenticated: false,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAuthCourse(value: unknown) {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.code === 'string' &&
    typeof value.title === 'string' &&
    (value.membershipRole === null ||
      value.membershipRole === 'INSTRUCTOR' ||
      value.membershipRole === 'STUDENT')
  )
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.email === 'string' &&
    typeof value.displayName === 'string' &&
    (value.role === 'ADMIN' ||
      value.role === 'INSTRUCTOR' ||
      value.role === 'STUDENT') &&
    (value.status === 'ACTIVE' || value.status === 'DISABLED') &&
    Array.isArray(value.courses) &&
    value.courses.every(isAuthCourse)
  )
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) {
    return false
  }

  return (
    isAuthUser(value.user) &&
    value.tokenType === 'Bearer' &&
    typeof value.accessToken === 'string' &&
    typeof value.accessTokenExpiresAt === 'string' &&
    typeof value.refreshToken === 'string' &&
    typeof value.refreshTokenExpiresAt === 'string'
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
      tokenType: storedSession.tokenType,
      accessToken: storedSession.accessToken,
      accessTokenExpiresAt: storedSession.accessTokenExpiresAt,
      refreshToken: storedSession.refreshToken,
      refreshTokenExpiresAt: storedSession.refreshTokenExpiresAt,
      isAuthenticated: true,
    }
  : emptyAuthState

export const useAuthStore = create<AuthStore>()((set) => ({
  ...initialAuthState,
  setSession: (session) => {
    persistSession(session)
    set({
      user: session.user,
      tokenType: session.tokenType,
      accessToken: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
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
