import { create } from 'zustand'

import type { AuthSession, AuthUser } from '@/features/auth/types/auth.types'

export const authSessionStorageKey = 'morshid.auth.session'
const authSessionStorageVersion = 1

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
  setUser: (user: AuthUser) => void
  clearSession: () => void
  logout: () => void
}

export type AuthStore = AuthStoreState & AuthStoreActions

type StoredAuthSession = Omit<AuthSession, 'tokenType'> & {
  v: typeof authSessionStorageVersion
}

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

function isStoredAuthSession(value: unknown): value is StoredAuthSession {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.v === authSessionStorageVersion &&
    isAuthUser(value.user) &&
    typeof value.accessToken === 'string' &&
    typeof value.accessTokenExpiresAt === 'string' &&
    typeof value.refreshToken === 'string' &&
    typeof value.refreshTokenExpiresAt === 'string'
  )
}

function isFutureIsoDate(value: string) {
  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp) && timestamp > Date.now()
}

function toStoredSession(session: AuthSession): StoredAuthSession {
  return {
    v: authSessionStorageVersion,
    user: session.user,
    accessToken: session.accessToken,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
  }
}

function toAuthSession(storedSession: StoredAuthSession): AuthSession {
  return {
    tokenType: 'Bearer',
    user: storedSession.user,
    accessToken: storedSession.accessToken,
    accessTokenExpiresAt: storedSession.accessTokenExpiresAt,
    refreshToken: storedSession.refreshToken,
    refreshTokenExpiresAt: storedSession.refreshTokenExpiresAt,
  }
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

    if (
      !isStoredAuthSession(parsedSession) ||
      !isFutureIsoDate(parsedSession.refreshTokenExpiresAt)
    ) {
      storage.removeItem(authSessionStorageKey)
      return null
    }

    return toAuthSession(parsedSession)
  } catch {
    storage.removeItem(authSessionStorageKey)
    return null
  }
}

function persistSession(session: AuthSession) {
  getLocalStorage()?.setItem(
    authSessionStorageKey,
    JSON.stringify(toStoredSession(session)),
  )
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
  setUser: (user) => {
    set((state) => {
      if (
        state.tokenType === null ||
        state.accessToken === null ||
        state.accessTokenExpiresAt === null ||
        state.refreshToken === null ||
        state.refreshTokenExpiresAt === null
      ) {
        removeStoredSession()
        return emptyAuthState
      }

      persistSession({
        user,
        tokenType: state.tokenType,
        accessToken: state.accessToken,
        accessTokenExpiresAt: state.accessTokenExpiresAt,
        refreshToken: state.refreshToken,
        refreshTokenExpiresAt: state.refreshTokenExpiresAt,
      })

      return {
        user,
        isAuthenticated: true,
      }
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
