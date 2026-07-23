import { authSessionSchema } from '@/features/auth/schemas/auth.schema'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/schemas/auth.schema'
import { clientEnv } from '@/lib/env'
import {
  buildApiError,
  buildApiUrl,
  buildHeaders,
  isApiError,
  readJsonBody,
} from '@/lib/api/http'
import type { ApiFetchOptions } from '@/lib/api/http'

export { ApiError, isApiError } from '@/lib/api/http'
export type { ApiFetchOptions } from '@/lib/api/http'

export function isTerminalAuthError(error: unknown) {
  return (
    isApiError(error) &&
    (error.status === 401 ||
      error.code === 'ACCOUNT_DISABLED' ||
      error.code === 'INVALID_REFRESH_TOKEN')
  )
}

const refreshSessionPromises = new Map<string, Promise<AuthSession>>()

class AuthSessionChangedError extends Error {
  constructor() {
    super('Authentication session changed while the request was in progress')
    this.name = 'AuthSessionChangedError'
  }
}

function refreshSession(
  refreshToken: string | null,
  sessionVersion: number,
  fetchImpl: typeof fetch,
  apiBaseUrl: string,
) {
  const refreshKey = `${sessionVersion}:${refreshToken}`
  const existingPromise = refreshSessionPromises.get(refreshKey)

  if (existingPromise) {
    return existingPromise
  }

  const refreshPromise = fetchImpl(
    buildApiUrl('/api/v1/auth/refresh', apiBaseUrl),
    {
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  )
    .then(async (response) => {
      const body = await readJsonBody(response)

      if (!response.ok) {
        throw buildApiError(response, body)
      }

      const session = authSessionSchema.parse(body)
      const wasApplied = useAuthStore
        .getState()
        .setRefreshedSession(session, sessionVersion, refreshToken)

      if (!wasApplied) {
        throw new AuthSessionChangedError()
      }

      return session
    })
    .finally(() => {
      refreshSessionPromises.delete(refreshKey)
    })

  refreshSessionPromises.set(refreshKey, refreshPromise)

  return refreshPromise
}

export async function restoreAuthSession(
  options: Pick<ApiFetchOptions, 'apiBaseUrl' | 'fetchImpl'> = {},
): Promise<AuthSession | null> {
  const { apiBaseUrl = clientEnv.VITE_API_BASE_URL, fetchImpl = fetch } =
    options
  let previousRefreshToken: string | null = null
  let attemptedCookieSession = false

  const initialAuthState = useAuthStore.getState()

  if (
    initialAuthState.isAuthenticated &&
    initialAuthState.user &&
    initialAuthState.accessToken
  ) {
    return null
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const authState = useAuthStore.getState()
    const { refreshToken, sessionVersion } = authState

    if (refreshToken) {
      if (refreshToken === previousRefreshToken) {
        return null
      }
    } else {
      if (attemptedCookieSession) {
        return null
      }

      attemptedCookieSession = true
    }

    try {
      return await refreshSession(
        refreshToken,
        sessionVersion,
        fetchImpl,
        apiBaseUrl,
      )
    } catch (error) {
      if (error instanceof AuthSessionChangedError) {
        previousRefreshToken = refreshToken
        continue
      }

      if (isTerminalAuthError(error)) {
        useAuthStore.getState().clearSession(sessionVersion)
        return null
      }

      throw error
    }
  }

  return null
}

async function apiFetchWithAuthRetry(
  path: string,
  options: ApiFetchOptions,
  hasRetried: boolean,
  expectedSessionVersion?: number,
): Promise<Response> {
  const {
    apiBaseUrl = clientEnv.VITE_API_BASE_URL,
    authenticated = true,
    fetchImpl = fetch,
    headers,
    ...requestInit
  } = options
  const authState = useAuthStore.getState()
  const sessionVersion = expectedSessionVersion ?? authState.sessionVersion

  if (
    expectedSessionVersion !== undefined &&
    authState.sessionVersion !== expectedSessionVersion
  ) {
    throw new AuthSessionChangedError()
  }

  const accessToken = authenticated ? authState.accessToken : null
  const response = await fetchImpl(buildApiUrl(path, apiBaseUrl), {
    ...requestInit,
    cache: requestInit.cache ?? 'no-store',
    credentials: requestInit.credentials ?? 'include',
    headers: buildHeaders(headers, accessToken),
  })

  if (response.ok) {
    return response
  }

  const body = await readJsonBody(response)
  const error = buildApiError(response, body)

  if (authenticated && error.code === 'ACCOUNT_DISABLED') {
    useAuthStore.getState().clearSession(sessionVersion)
  }

  if (!authenticated || error.code !== 'INVALID_ACCESS_TOKEN') {
    throw error
  }

  const currentAuthState = useAuthStore.getState()

  if (currentAuthState.sessionVersion !== sessionVersion) {
    throw error
  }

  if (hasRetried) {
    currentAuthState.clearSession(sessionVersion)
    throw error
  }

  if (currentAuthState.accessToken !== accessToken) {
    return apiFetchWithAuthRetry(path, options, true, sessionVersion)
  }

  try {
    await refreshSession(
      currentAuthState.refreshToken,
      sessionVersion,
      fetchImpl,
      apiBaseUrl,
    )
  } catch (refreshError) {
    if (refreshError instanceof AuthSessionChangedError) {
      throw error
    }

    if (isTerminalAuthError(refreshError)) {
      useAuthStore.getState().clearSession(sessionVersion)
    }

    throw refreshError
  }

  return apiFetchWithAuthRetry(path, options, true, sessionVersion)
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  return apiFetchWithAuthRetry(path, options, false)
}

export async function apiJson<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const response = await apiFetch(path, options)

  return (await response.json()) as T
}
