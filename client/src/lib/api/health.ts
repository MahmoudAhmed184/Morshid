import { clientEnv } from '@/lib/env'

export type HealthCheckStatus = 'ok' | 'error' | 'shutting_down'

export type HealthCheckResponse = {
  status: HealthCheckStatus
  info?: Record<string, unknown>
  error?: Record<string, unknown>
  details?: Record<string, unknown>
}

export class ApiHealthError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiHealthError'
  }
}

function buildApiUrl(path: string, apiBaseUrl = clientEnv.VITE_API_BASE_URL) {
  const baseUrl = `${apiBaseUrl.replace(/\/+$/, '')}/`
  return new URL(path.replace(/^\/+/, ''), baseUrl)
}

export async function fetchReadinessStatus(
  fetchImpl: typeof fetch = fetch,
  apiBaseUrl = clientEnv.VITE_API_BASE_URL,
): Promise<HealthCheckResponse> {
  const response = await fetchImpl(buildApiUrl('/health/ready', apiBaseUrl), {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new ApiHealthError(
      `Readiness check failed with status ${response.status}`,
      response.status,
    )
  }

  return (await response.json()) as HealthCheckResponse
}
