import { getCurrentUser } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthUser } from '@/features/auth/types/auth.types'

const authValidationCacheMs = 5_000

let authValidationPromise: Promise<AuthUser | null> | null = null
let lastAuthValidation:
  | {
      accessToken: string
      user: AuthUser
      validatedAt: number
    }
  | null = null

function clearAuthValidationCache() {
  lastAuthValidation = null
}

function getCachedUser(accessToken: string) {
  if (
    lastAuthValidation &&
    lastAuthValidation.accessToken === accessToken &&
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

  const { accessToken, clearSession, isAuthenticated, setUser, user } =
    useAuthStore.getState()

  if (!isAuthenticated || !user || !accessToken) {
    clearAuthValidationCache()
    return null
  }

  const cachedUser = getCachedUser(accessToken)

  if (cachedUser) {
    return cachedUser
  }

  authValidationPromise ??= getCurrentUser()
    .then((response) => {
      const latestAccessToken = useAuthStore.getState().accessToken

      if (latestAccessToken) {
        lastAuthValidation = {
          accessToken: latestAccessToken,
          user: response.user,
          validatedAt: Date.now(),
        }
      }

      setUser(response.user)

      return response.user
    })
    .catch(() => {
      clearAuthValidationCache()
      clearSession()

      return null
    })
    .finally(() => {
      authValidationPromise = null
    })

  return authValidationPromise
}
