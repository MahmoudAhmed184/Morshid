import type {
  AuthApiError,
  AuthApiErrorCode,
  LoginApiResponse,
  MeResponse,
} from '@/features/auth/types/auth.types'
import { apiJson, type ApiFetchOptions } from '@/lib/api/api-client'
import { clientEnv } from '@/lib/env'

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.'
export const DISABLED_ACCOUNT_MESSAGE =
  'Your account is disabled. Please contact the administrator.'
export const SIGN_IN_UNAVAILABLE_MESSAGE =
  'Unable to sign in. Please try again.'

type SignInApiErrorResponse = {
  code?: unknown
  message?: unknown
}

function createAuthApiError(
  code: AuthApiErrorCode,
  message: string,
): AuthApiError {
  return Object.assign(new Error(message), {
    code,
    name: 'AuthApiError',
  })
}

export function isAuthApiError(error: unknown): error is AuthApiError {
  return error instanceof Error && error.name === 'AuthApiError'
}

function buildApiUrl(path: string, apiBaseUrl = clientEnv.VITE_API_BASE_URL) {
  const baseUrl = `${apiBaseUrl.replace(/\/+$/, '')}/`
  return new URL(path.replace(/^\/+/, ''), baseUrl)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAuthApiErrorCode(value: unknown): value is AuthApiErrorCode {
  return (
    value === 'ACCOUNT_DISABLED' ||
    value === 'INSUFFICIENT_ROLE' ||
    value === 'INVALID_ACCESS_TOKEN' ||
    value === 'INVALID_CREDENTIALS' ||
    value === 'INVALID_REFRESH_TOKEN' ||
    value === 'INVALID_REQUEST'
  )
}

function normalizeSignInError(
  errorResponse: SignInApiErrorResponse | null,
): AuthApiError {
  const code = isAuthApiErrorCode(errorResponse?.code)
    ? errorResponse.code
    : 'INVALID_CREDENTIALS'

  if (code === 'ACCOUNT_DISABLED') {
    return createAuthApiError(code, DISABLED_ACCOUNT_MESSAGE)
  }

  if (code === 'INVALID_CREDENTIALS' || code === 'INVALID_REQUEST') {
    return createAuthApiError(
      'INVALID_CREDENTIALS',
      INVALID_CREDENTIALS_MESSAGE,
    )
  }

  return createAuthApiError(code, SIGN_IN_UNAVAILABLE_MESSAGE)
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function loginApi(
  email: string,
  password: string,
  fetchImpl: typeof fetch = fetch,
  apiBaseUrl = clientEnv.VITE_API_BASE_URL,
): Promise<LoginApiResponse> {
  let response: Response

  try {
    response = await fetchImpl(
      buildApiUrl('/api/v1/auth/sign-in', apiBaseUrl),
      {
        body: JSON.stringify({
          email,
          password,
        }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    )
  } catch {
    throw createAuthApiError('INVALID_REQUEST', SIGN_IN_UNAVAILABLE_MESSAGE)
  }

  const body = await readJsonBody(response)

  if (!response.ok) {
    throw normalizeSignInError(isRecord(body) ? body : null)
  }

  return body as LoginApiResponse
}

export async function getCurrentUser(
  options: ApiFetchOptions = {},
): Promise<MeResponse> {
  return apiJson<MeResponse>('/api/v1/me', options)
}
