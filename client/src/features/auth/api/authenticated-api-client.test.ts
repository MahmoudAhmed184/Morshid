import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/schemas/auth.schema'

import { ApiError, apiFetch, apiJson } from './authenticated-api-client'

const mockSession: AuthSession = {
  tokenType: 'Bearer',
  user: {
    id: 'user-1',
    email: 'student1@morshid.demo',
    displayName: 'P0 Demo Student',
    role: 'STUDENT',
    status: 'ACTIVE',
    courses: [],
  },
  accessToken: 'current-access-token',
  accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
  refreshToken: 'current-refresh-token',
  refreshTokenExpiresAt: '2026-07-18T12:00:00.000Z',
}

const refreshedSession: AuthSession = {
  ...mockSession,
  accessToken: 'rotated-access-token',
  accessTokenExpiresAt: '2026-07-11T12:30:00.000Z',
  refreshToken: 'rotated-refresh-token',
  refreshTokenExpiresAt: '2026-07-18T12:15:00.000Z',
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

describe('api client', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    window.sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('sends the current bearer token with API requests', async () => {
    useAuthStore.getState().setSession(mockSession)

    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:4000/api/v1/courses')
      expect(init?.method).toBe('GET')
      expect(init?.credentials).toBe('include')

      const headers = new Headers(init?.headers)

      expect(headers.get('Accept')).toBe('application/json')
      expect(headers.get('Authorization')).toBe('Bearer current-access-token')

      return Response.json({ courses: [] })
    }

    await expect(
      apiJson<{ courses: unknown[] }>('/api/v1/courses', {
        fetchImpl: fetchMock,
        method: 'GET',
      }),
    ).resolves.toEqual({ courses: [] })
  })

  it('does not send authorization when no access token exists', async () => {
    const fetchMock = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)

      expect(headers.get('Authorization')).toBeNull()

      return Response.json({ ok: true })
    }

    await expect(
      apiJson<{ ok: boolean }>('/api/v1/me', {
        fetchImpl: fetchMock,
      }),
    ).resolves.toEqual({ ok: true })
  })

  it('parses server error envelopes', async () => {
    useAuthStore.getState().setSession(mockSession)

    const fetchMock = async () =>
      Response.json(
        {
          code: 'INSUFFICIENT_ROLE',
          message: 'Insufficient role',
        },
        {
          status: 403,
        },
      )

    await expect(
      apiFetch('/api/v1/admin-only', {
        fetchImpl: fetchMock,
      }),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_ROLE',
      message: 'Insufficient role',
      name: 'ApiError',
      status: 403,
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('clears the matching session when the account is disabled', async () => {
    useAuthStore.getState().setSession(mockSession)

    const fetchMock = async () =>
      Response.json(
        {
          code: 'ACCOUNT_DISABLED',
          message: 'Account is disabled',
        },
        { status: 403 },
      )

    await expect(
      apiFetch('/api/v1/me', { fetchImpl: fetchMock }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_DISABLED' })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('refreshes an expired access token and retries the request once', async () => {
    useAuthStore.getState().setSession(mockSession)

    let protectedRequestCount = 0

    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === 'http://localhost:4000/api/v1/auth/refresh') {
        expect(JSON.parse(String(init?.body))).toEqual({
          refreshToken: 'current-refresh-token',
        })

        return Response.json(refreshedSession)
      }

      protectedRequestCount += 1

      if (protectedRequestCount === 1) {
        expect(new Headers(init?.headers).get('Authorization')).toBe(
          'Bearer current-access-token',
        )

        return Response.json(
          {
            code: 'INVALID_ACCESS_TOKEN',
            message: 'Invalid access token',
          },
          {
            status: 401,
          },
        )
      }

      expect(new Headers(init?.headers).get('Authorization')).toBe(
        'Bearer rotated-access-token',
      )

      return Response.json({ user: refreshedSession.user })
    }

    await expect(
      apiJson('/api/v1/me', {
        fetchImpl: fetchMock,
      }),
    ).resolves.toEqual({ user: refreshedSession.user })
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
      user: refreshedSession.user,
    })
    expect(protectedRequestCount).toBe(2)
  })

  it('shares one refresh request across concurrent expired access token failures', async () => {
    useAuthStore.getState().setSession(mockSession)

    let protectedRequestCount = 0
    let refreshRequestCount = 0

    const fetchMock = async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === 'http://localhost:4000/api/v1/auth/refresh') {
        refreshRequestCount += 1

        await new Promise((resolve) => {
          window.setTimeout(resolve, 10)
        })

        return Response.json(refreshedSession)
      }

      protectedRequestCount += 1

      if (protectedRequestCount <= 2) {
        return Response.json(
          {
            code: 'INVALID_ACCESS_TOKEN',
            message: 'Invalid access token',
          },
          {
            status: 401,
          },
        )
      }

      return Response.json({ ok: true })
    }

    await expect(
      Promise.all([
        apiJson('/api/v1/me', { fetchImpl: fetchMock }),
        apiJson('/api/v1/courses', { fetchImpl: fetchMock }),
      ]),
    ).resolves.toEqual([{ ok: true }, { ok: true }])
    expect(refreshRequestCount).toBe(1)
    expect(protectedRequestCount).toBe(4)
  })

  it('clears auth when access token refresh fails', async () => {
    useAuthStore.getState().setSession(mockSession)

    const fetchMock = async (input: RequestInfo | URL) => {
      if (String(input) === 'http://localhost:4000/api/v1/auth/refresh') {
        return Response.json(
          {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid refresh token',
          },
          {
            status: 401,
          },
        )
      }

      return Response.json(
        {
          code: 'INVALID_ACCESS_TOKEN',
          message: 'Invalid access token',
        },
        {
          status: 401,
        },
      )
    }

    await expect(
      apiFetch('/api/v1/me', {
        fetchImpl: fetchMock,
      }),
    ).rejects.toBeInstanceOf(ApiError)
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: null,
      isAuthenticated: false,
      refreshToken: null,
      user: null,
    })
  })

  it('preserves the session when refresh fails because the network is unavailable', async () => {
    useAuthStore.getState().setSession(mockSession)

    const fetchMock = async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/refresh')) {
        throw new TypeError('Failed to fetch')
      }

      return Response.json(
        {
          code: 'INVALID_ACCESS_TOKEN',
          message: 'Invalid access token',
        },
        { status: 401 },
      )
    }

    await expect(
      apiFetch('/api/v1/me', { fetchImpl: fetchMock }),
    ).rejects.toThrow('Failed to fetch')
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: mockSession.accessToken,
      isAuthenticated: true,
      refreshToken: mockSession.refreshToken,
    })
  })

  it('does not restore a session when refresh completes after logout', async () => {
    useAuthStore.getState().setSession(mockSession)
    const refreshResponse = createDeferred<Response>()
    const refreshStarted = createDeferred<void>()

    const fetchMock = async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/refresh')) {
        refreshStarted.resolve()
        return refreshResponse.promise
      }

      return Response.json(
        {
          code: 'INVALID_ACCESS_TOKEN',
          message: 'Invalid access token',
        },
        { status: 401 },
      )
    }
    const request = apiFetch('/api/v1/me', { fetchImpl: fetchMock })
    const requestAssertion = expect(request).rejects.toBeInstanceOf(ApiError)

    await refreshStarted.promise
    useAuthStore.getState().clearSession()
    refreshResponse.resolve(Response.json(refreshedSession))

    await requestAssertion
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('does not retry an old request under a newly signed-in account', async () => {
    useAuthStore.getState().setSession(mockSession)
    const oldResponse = createDeferred<Response>()
    const requestStarted = createDeferred<void>()
    let refreshRequestCount = 0

    const fetchMock = async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/refresh')) {
        refreshRequestCount += 1
        return Response.json(refreshedSession)
      }

      requestStarted.resolve()
      return oldResponse.promise
    }
    const request = apiFetch('/api/v1/courses', { fetchImpl: fetchMock })
    const requestAssertion = expect(request).rejects.toBeInstanceOf(ApiError)
    const nextSession: AuthSession = {
      ...mockSession,
      user: {
        ...mockSession.user,
        id: 'admin-2',
        email: 'admin@morshid.demo',
        role: 'ADMIN',
      },
      accessToken: 'admin-access-token',
      refreshToken: 'admin-refresh-token',
    }

    await requestStarted.promise
    useAuthStore.getState().setSession(nextSession)
    oldResponse.resolve(
      Response.json(
        {
          code: 'INVALID_ACCESS_TOKEN',
          message: 'Invalid access token',
        },
        { status: 401 },
      ),
    )

    await requestAssertion
    expect(refreshRequestCount).toBe(0)
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'admin-access-token',
      user: nextSession.user,
    })
  })

  it('retries a delayed 401 with an already-refreshed access token', async () => {
    useAuthStore.getState().setSession(mockSession)
    const delayedResponse = createDeferred<Response>()
    let refreshRequestCount = 0
    let firstRequestCount = 0
    let delayedRequestCount = 0

    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/auth/refresh')) {
        refreshRequestCount += 1
        return Response.json(refreshedSession)
      }

      if (url.endsWith('/first')) {
        firstRequestCount += 1
        return firstRequestCount === 1
          ? Response.json(
              {
                code: 'INVALID_ACCESS_TOKEN',
                message: 'Invalid access token',
              },
              { status: 401 },
            )
          : Response.json({ ok: true })
      }

      delayedRequestCount += 1

      if (delayedRequestCount === 1) {
        return delayedResponse.promise
      }

      expect(new Headers(init?.headers).get('Authorization')).toBe(
        'Bearer rotated-access-token',
      )
      return Response.json({ ok: true })
    }

    const delayedRequest = apiJson('/api/v1/delayed', { fetchImpl: fetchMock })

    await expect(
      apiJson('/api/v1/first', { fetchImpl: fetchMock }),
    ).resolves.toEqual({ ok: true })
    delayedResponse.resolve(
      Response.json(
        {
          code: 'INVALID_ACCESS_TOKEN',
          message: 'Invalid access token',
        },
        { status: 401 },
      ),
    )

    await expect(delayedRequest).resolves.toEqual({ ok: true })
    expect(refreshRequestCount).toBe(1)
  })

  it('keeps caller headers while applying auth defaults', async () => {
    useAuthStore.getState().setSession(mockSession)

    const fetchMock = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)

      expect(headers.get('Accept')).toBe('application/problem+json')
      expect(headers.get('Authorization')).toBe('Bearer current-access-token')
      expect(headers.get('X-Request-ID')).toBe('request-1')

      return Response.json({ ok: true })
    }

    await apiFetch('/api/v1/me', {
      fetchImpl: fetchMock,
      headers: {
        Accept: 'application/problem+json',
        'X-Request-ID': 'request-1',
      },
    })
  })
})
