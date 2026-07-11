import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/types/auth.types'

import { ApiError, apiFetch, apiJson } from './api-client'

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

describe('api client', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('sends the current bearer token with API requests', async () => {
    useAuthStore.getState().setSession(mockSession)

    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:4000/api/v1/courses')
      expect(init?.method).toBe('GET')

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

  it('clears auth when the server rejects an invalid access token', async () => {
    useAuthStore.getState().setSession(mockSession)

    const fetchMock = async () =>
      Response.json(
        {
          code: 'INVALID_ACCESS_TOKEN',
          message: 'Invalid access token',
        },
        {
          status: 401,
        },
      )

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
