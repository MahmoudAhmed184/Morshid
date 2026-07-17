import { create } from 'zustand'

import type { AuthSession, AuthUser } from '@/features/auth/schemas/auth.schema'

export const authSessionStorageKey = 'morshid.auth.session'

type AuthStoreState = {
  user: AuthUser | null
  tokenType: AuthSession['tokenType'] | null
  accessToken: string | null
  accessTokenExpiresAt: string | null
  refreshToken: string | null
  refreshTokenExpiresAt: string | null
  refreshTokenUserId: string | null
  isAuthenticated: boolean
  sessionVersion: number
}

type AuthStoreActions = {
  setSession: (session: AuthSession) => void
  setRefreshedSession: (
    session: AuthSession,
    expectedSessionVersion: number,
    expectedRefreshToken: string | null,
  ) => boolean
  setUser: (user: AuthUser, expectedSessionVersion?: number) => boolean
  clearSession: (expectedSessionVersion?: number) => boolean
}

export type AuthStore = AuthStoreState & AuthStoreActions

const emptySessionState = {
  user: null,
  tokenType: null,
  accessToken: null,
  accessTokenExpiresAt: null,
  refreshToken: null,
  refreshTokenExpiresAt: null,
  refreshTokenUserId: null,
  isAuthenticated: false,
} satisfies Omit<AuthStoreState, 'sessionVersion'>

function getBrowserStorage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

function removeStoredSession() {
  for (const kind of ['local', 'session'] as const) {
    try {
      getBrowserStorage(kind)?.removeItem(authSessionStorageKey)
    } catch {
      // Clearing in-memory state must not depend on browser storage availability.
    }
  }
}

function toAuthState(
  session: AuthSession,
): Omit<AuthStoreState, 'sessionVersion'> {
  return {
    user: session.user,
    tokenType: session.tokenType,
    accessToken: session.accessToken,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    refreshTokenUserId: session.user.id,
    isAuthenticated: true,
  }
}

removeStoredSession()

const initialAuthState: AuthStoreState = {
  ...emptySessionState,
  sessionVersion: 0,
}

export const useAuthStore = create<AuthStore>()((set) => ({
  ...initialAuthState,
  setSession: (session) => {
    set((state) => ({
      ...toAuthState(session),
      sessionVersion: state.sessionVersion + 1,
    }))
  },
  setRefreshedSession: (
    session,
    expectedSessionVersion,
    expectedRefreshToken,
  ) => {
    let wasUpdated = false

    set((state) => {
      if (
        state.sessionVersion !== expectedSessionVersion ||
        state.refreshToken !== expectedRefreshToken
      ) {
        return state
      }

      wasUpdated = true

      return {
        ...toAuthState(session),
        sessionVersion: state.sessionVersion,
      }
    })

    return wasUpdated
  },
  setUser: (user, expectedSessionVersion) => {
    let wasUpdated = false

    set((state) => {
      if (
        (expectedSessionVersion !== undefined &&
          state.sessionVersion !== expectedSessionVersion) ||
        state.tokenType === null ||
        state.accessToken === null ||
        state.accessTokenExpiresAt === null ||
        state.refreshToken === null ||
        state.refreshTokenExpiresAt === null
      ) {
        return state
      }

      wasUpdated = true
      return { user }
    })

    return wasUpdated
  },
  clearSession: (expectedSessionVersion) => {
    let wasCleared = false

    set((state) => {
      if (
        expectedSessionVersion !== undefined &&
        state.sessionVersion !== expectedSessionVersion
      ) {
        return state
      }

      removeStoredSession()
      wasCleared = true

      return {
        ...emptySessionState,
        sessionVersion: state.sessionVersion + 1,
      }
    })

    return wasCleared
  },
}))
