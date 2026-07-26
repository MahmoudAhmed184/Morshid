import {
  authSessionSchema,
  meResponseSchema,
} from '@/features/auth/schemas/auth.schema'
import type {
  AuthSession,
  MeResponse,
} from '@/features/auth/schemas/auth.schema'
import {
  ApiError,
  apiFetch,
  apiJson,
  isApiError,
} from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import { clientEnv } from '@/lib/env'

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.'
export const DISABLED_ACCOUNT_MESSAGE =
  'Your account is disabled. Please contact the administrator.'
export const SIGN_IN_UNAVAILABLE_MESSAGE =
  'Unable to sign in. Please try again.'

function normalizeSignInError(error: unknown): ApiError {
  if (!isApiError(error)) {
    return new ApiError(SIGN_IN_UNAVAILABLE_MESSAGE, 0, 'INVALID_REQUEST')
  }

  if (error.code === 'ACCOUNT_DISABLED') {
    return new ApiError(DISABLED_ACCOUNT_MESSAGE, error.status, error.code)
  }

  if (
    error.code === 'INVALID_CREDENTIALS' ||
    error.code === 'INVALID_REQUEST'
  ) {
    return new ApiError(
      INVALID_CREDENTIALS_MESSAGE,
      error.status,
      'INVALID_CREDENTIALS',
    )
  }

  return new ApiError(
    SIGN_IN_UNAVAILABLE_MESSAGE,
    error.status,
    error.code ?? 'INVALID_REQUEST',
  )
}

export async function loginApi(
  email: string,
  password: string,
  fetchImpl: typeof fetch = fetch,
  apiBaseUrl = clientEnv.VITE_API_BASE_URL,
): Promise<AuthSession> {
  try {
    const body = await apiJson<unknown>('/api/v1/auth/sign-in', {
      apiBaseUrl,
      authenticated: false,
      body: JSON.stringify({ email, password }),
      fetchImpl,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    return authSessionSchema.parse(body)
  } catch (error) {
    throw normalizeSignInError(error)
  }
}

export async function getCurrentUser(
  options: ApiFetchOptions = {},
): Promise<MeResponse> {
  const body = await apiJson<unknown>('/api/v1/me', options)

  return meResponseSchema.parse(body)
}

export async function logoutApi(
  refreshToken?: string | null,
  fetchImpl: typeof fetch = fetch,
  apiBaseUrl = clientEnv.VITE_API_BASE_URL,
): Promise<void> {
  await apiFetch('/api/v1/auth/logout', {
    apiBaseUrl,
    authenticated: false,
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    fetchImpl,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
}
