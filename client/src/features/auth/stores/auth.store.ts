import { create } from 'zustand'
import { z } from 'zod'

import { authSessionSchema } from '@/features/auth/schemas/auth.schema'
import type { AuthSession, AuthUser } from '@/features/auth/types/auth.types'

export const authSessionStorageKey = 'morshid.auth.session'
const persistedRefreshVersion = 2
const legacySessionVersion = 1

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
    expectedRefreshToken: string,
  ) => boolean
  setUser: (user: AuthUser, expectedSessionVersion?: number) => boolean
  clearSession: (expectedSessionVersion?: number) => boolean
}

export type AuthStore = AuthStoreState & AuthStoreActions

const persistedRefreshSchema = z.object({
  v: z.literal(persistedRefreshVersion),
  userId: z.string().min(1),
  refreshToken: z.string().min(1),
  refreshTokenExpiresAt: z.iso.datetime(),
})

const legacyStoredSessionSchema = authSessionSchema
  .omit({ tokenType: true })
  .extend({ v: z.literal(legacySessionVersion) })

type PersistedRefresh = z.infer<typeof persistedRefreshSchema>

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

function isFutureIsoDate(value: string) {
  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp) && timestamp > Date.now()
}

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

function parsePersistedRefresh(value: string | null): PersistedRefresh | null {
  if (!value) {
    return null
  }

  try {
    const parsedValue: unknown = JSON.parse(value)
    const currentResult = persistedRefreshSchema.safeParse(parsedValue)

    if (
      currentResult.success &&
      isFutureIsoDate(currentResult.data.refreshTokenExpiresAt)
    ) {
      return currentResult.data
    }

    const legacyResult = legacyStoredSessionSchema.safeParse(parsedValue)

    if (
      !legacyResult.success ||
      !isFutureIsoDate(legacyResult.data.refreshTokenExpiresAt)
    ) {
      return null
    }

    return {
      v: persistedRefreshVersion,
      userId: legacyResult.data.user.id,
      refreshToken: legacyResult.data.refreshToken,
      refreshTokenExpiresAt: legacyResult.data.refreshTokenExpiresAt,
    }
  } catch {
    return null
  }
}

function writePersistedRefresh(refresh: PersistedRefresh) {
  try {
    getBrowserStorage('local')?.setItem(
      authSessionStorageKey,
      JSON.stringify(refresh),
    )
    getBrowserStorage('session')?.removeItem(authSessionStorageKey)
  } catch {
    // The in-memory session remains usable when browser storage is unavailable.
  }
}

function readPersistedRefresh(): PersistedRefresh | null {
  const localStorage = getBrowserStorage('local')
  const sessionStorage = getBrowserStorage('session')

  try {
    const localValue = localStorage?.getItem(authSessionStorageKey) ?? null
    const localRefresh = parsePersistedRefresh(localValue)

    if (localRefresh) {
      writePersistedRefresh(localRefresh)
      return localRefresh
    }

    if (localValue) {
      localStorage?.removeItem(authSessionStorageKey)
    }

    const legacySessionValue =
      sessionStorage?.getItem(authSessionStorageKey) ?? null
    const migratedRefresh = parsePersistedRefresh(legacySessionValue)

    sessionStorage?.removeItem(authSessionStorageKey)

    if (migratedRefresh) {
      writePersistedRefresh(migratedRefresh)
    }

    return migratedRefresh
  } catch {
    return null
  }
}

function persistSessionRefresh(session: AuthSession) {
  writePersistedRefresh({
    v: persistedRefreshVersion,
    userId: session.user.id,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
  })
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

const persistedRefresh = readPersistedRefresh()

const initialAuthState: AuthStoreState = persistedRefresh
  ? {
      ...emptySessionState,
      refreshToken: persistedRefresh.refreshToken,
      refreshTokenExpiresAt: persistedRefresh.refreshTokenExpiresAt,
      refreshTokenUserId: persistedRefresh.userId,
      sessionVersion: 0,
    }
  : {
      ...emptySessionState,
      sessionVersion: 0,
    }

export const useAuthStore = create<AuthStore>()((set) => ({
  ...initialAuthState,
  setSession: (session) => {
    persistSessionRefresh(session)
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

      persistSessionRefresh(session)
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

export function syncAuthRefreshFromStorage(storedValue: string | null) {
  const refresh = parsePersistedRefresh(storedValue)

  useAuthStore.setState((state) => {
    if (!refresh) {
      return {
        ...emptySessionState,
        sessionVersion: state.sessionVersion + 1,
      }
    }

    if (state.refreshTokenUserId === refresh.userId) {
      return {
        refreshToken: refresh.refreshToken,
        refreshTokenExpiresAt: refresh.refreshTokenExpiresAt,
      }
    }

    return {
      ...emptySessionState,
      refreshToken: refresh.refreshToken,
      refreshTokenExpiresAt: refresh.refreshTokenExpiresAt,
      refreshTokenUserId: refresh.userId,
      sessionVersion: state.sessionVersion + 1,
    }
  })
}
