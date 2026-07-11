import { describe, expect, it } from 'vitest'

import {
  DISABLED_ACCOUNT_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  SIGN_IN_UNAVAILABLE_MESSAGE,
  getCurrentUser,
  loginApi,
} from './auth.api'

const mockSession = {
  tokenType: 'Bearer',
  accessToken: 'server-access-token',
  accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
  refreshToken: 'server-refresh-token',
  refreshTokenExpiresAt: '2026-07-18T12:00:00.000Z',
  user: {
    id: 'user-1',
    email: 'instructor@morshid.demo',
    displayName: 'P0 Demo Instructor',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    courses: [],
  },
}

describe('loginApi', () => {
  it('posts credentials to the server sign-in endpoint', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:4000/api/v1/auth/sign-in')
      expect(init).toMatchObject({
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })
      expect(JSON.parse(String(init?.body))).toEqual({
        email: 'instructor@morshid.demo',
        password: 'password',
      })

      return Response.json(mockSession)
    }

    await expect(
      loginApi('instructor@morshid.demo', 'password', fetchMock),
    ).resolves.toEqual(mockSession)
  })

  it('rejects invalid credentials with the client-safe generic error', async () => {
    const fetchMock = async () =>
      Response.json(
        {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
        {
          status: 401,
        },
      )
    const request = loginApi('admin@morshid.demo', 'notright', fetchMock)
    const assertion = expect(request).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: INVALID_CREDENTIALS_MESSAGE,
    })

    await assertion
  })

  it('normalizes invalid auth requests to the generic credentials error', async () => {
    const fetchMock = async () =>
      Response.json(
        {
          code: 'INVALID_REQUEST',
          message: 'Invalid auth request',
        },
        {
          status: 400,
        },
      )
    const request = loginApi('not-an-email', 'password', fetchMock)
    const assertion = expect(request).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: INVALID_CREDENTIALS_MESSAGE,
    })

    await assertion
  })

  it('normalizes disabled account responses to the client-safe disabled message', async () => {
    const fetchMock = async () =>
      Response.json(
        {
          code: 'ACCOUNT_DISABLED',
          message: 'Account is disabled',
        },
        {
          status: 403,
        },
      )
    const request = loginApi('disabled@morshid.demo', 'password', fetchMock)
    const assertion = expect(request).rejects.toMatchObject({
      code: 'ACCOUNT_DISABLED',
      message: DISABLED_ACCOUNT_MESSAGE,
    })

    await assertion
  })

  it('uses a safe fallback for unexpected auth errors', async () => {
    const fetchMock = async () =>
      Response.json(
        {
          code: 'INVALID_ACCESS_TOKEN',
          message: 'Internal implementation detail',
        },
        {
          status: 401,
        },
      )
    const request = loginApi('admin@morshid.demo', 'password', fetchMock)
    const assertion = expect(request).rejects.toMatchObject({
      code: 'INVALID_ACCESS_TOKEN',
      message: SIGN_IN_UNAVAILABLE_MESSAGE,
    })

    await assertion
  })

  it('uses a safe fallback when the sign-in request cannot reach the server', async () => {
    const fetchMock = async () => {
      throw new TypeError('failed to fetch')
    }
    const request = loginApi('admin@morshid.demo', 'password', fetchMock)
    const assertion = expect(request).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      message: SIGN_IN_UNAVAILABLE_MESSAGE,
    })

    await assertion
  })
})

describe('getCurrentUser', () => {
  it('requests the current user from /me with the authenticated API client', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:4000/api/v1/me')

      const headers = new Headers(init?.headers)

      expect(headers.get('Accept')).toBe('application/json')

      return Response.json({
        user: mockSession.user,
      })
    }

    await expect(getCurrentUser({ fetchImpl: fetchMock })).resolves.toEqual({
      user: mockSession.user,
    })
  })
})
