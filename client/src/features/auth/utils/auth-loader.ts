import { getCurrentUser } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthUser } from '@/features/auth/types/auth.types'
import { isTerminalAuthError, restoreAuthSession } from '@/lib/api/api-client'

const authValidationCacheMs = 5_000

const authValidationPromises = new Map<number, Promise<AuthUser | null>>()
let lastAuthValidation: {
  sessionVersion: number
  user: AuthUser
  validatedAt: number
} | null = null

function clearAuthValidationCache() {
  lastAuthValidation = null
}

function getCachedUser(sessionVersion: number) {
  if (
    lastAuthValidation &&
    lastAuthValidation.sessionVersion === sessionVersion &&
    Date.now() - lastAuthValidation.validatedAt < authValidationCacheMs
  ) {
    return lastAuthValidation.user
  }

  return null
}

export async function loadAuthenticatedUser(): Promise<AuthUser | null> {
  if (typeof window === 'undefined') {
    return null
  }

  let authState = useAuthStore.getState()

  if (
    (!authState.isAuthenticated || !authState.user || !authState.accessToken) &&
    authState.refreshToken
  ) {
    const restoredSession = await restoreAuthSession()

    if (!restoredSession) {
      return useAuthStore.getState().user
    }

    authState = useAuthStore.getState()
    lastAuthValidation = {
      sessionVersion: authState.sessionVersion,
      user: restoredSession.user,
      validatedAt: Date.now(),
    }

    return restoredSession.user
  }

  const { accessToken, isAuthenticated, sessionVersion, user } = authState

  if (!isAuthenticated || !user || !accessToken) {
    clearAuthValidationCache()
    return null
  }

  const cachedUser = getCachedUser(sessionVersion)

  if (cachedUser) {
    return cachedUser
  }

  const existingPromise = authValidationPromises.get(sessionVersion)

  if (existingPromise) {
    return existingPromise
  }

  const authValidationPromise = getCurrentUser()
    .then((response) => {
      const latestAuthState = useAuthStore.getState()

      if (latestAuthState.sessionVersion !== sessionVersion) {
        return latestAuthState.user
      }

      const wasUpdated = latestAuthState.setUser(response.user, sessionVersion)

      if (!wasUpdated) {
        return null
      }

      lastAuthValidation = {
        sessionVersion,
        user: response.user,
        validatedAt: Date.now(),
      }

      return response.user
    })
    .catch((error: unknown) => {
      clearAuthValidationCache()

      const latestAuthState = useAuthStore.getState()

      if (latestAuthState.sessionVersion !== sessionVersion) {
        return latestAuthState.user
      }

      if (isTerminalAuthError(error)) {
        latestAuthState.clearSession(sessionVersion)
        return null
      }

      throw error
    })
    .finally(() => {
      authValidationPromises.delete(sessionVersion)
    })

  authValidationPromises.set(sessionVersion, authValidationPromise)

  return authValidationPromise
}
