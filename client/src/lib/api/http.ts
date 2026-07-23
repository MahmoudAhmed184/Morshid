import { clientEnv } from '@/lib/env'

type ApiErrorEnvelope = {
  code?: unknown
  message?: unknown
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export type ApiFetchOptions = RequestInit & {
  apiBaseUrl?: string
  authenticated?: boolean
  fetchImpl?: typeof fetch
}

export function buildApiUrl(
  path: string,
  apiBaseUrl = clientEnv.VITE_API_BASE_URL,
) {
  const baseUrl = `${apiBaseUrl.replace(/\/+$/, '')}/`
  return new URL(path.replace(/^\/+/, ''), baseUrl)
}

export function buildHeaders(
  headers: HeadersInit | undefined,
  accessToken: string | null,
) {
  const nextHeaders = new Headers(headers)

  if (!nextHeaders.has('Accept')) {
    nextHeaders.set('Accept', 'application/json')
  }

  if (accessToken) {
    nextHeaders.set('Authorization', `Bearer ${accessToken}`)
  }

  return nextHeaders
}

export async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function buildApiError(response: Response, body: unknown) {
  const envelope: ApiErrorEnvelope | null = isRecord(body) ? body : null
  const code = typeof envelope?.code === 'string' ? envelope.code : undefined
  const message =
    typeof envelope?.message === 'string'
      ? envelope.message
      : `Request failed with status ${response.status}`

  return new ApiError(message, response.status, code)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
