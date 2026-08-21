import { describe, expect, it } from 'vitest'

import {
  changePasswordApi,
  DISABLED_ACCOUNT_MESSAGE,
  getCurrentUser,
  INVALID_CREDENTIALS_MESSAGE,
  loginApi,
  logoutApi,
  SIGN_IN_UNAVAILABLE_MESSAGE,
  UNIVERSITY_INACTIVE_MESSAGE,
  UNIVERSITY_SUSPENDED_MESSAGE,
  updateOwnProfile,
} from './session.api'

const mockSession = {
  tokenType: 'Bearer',
  accessToken: 'server-access-token',
  accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
  user: {
    id: 'user-1',
    email: 'instructor@morshid.demo',
    displayName: 'P0 Demo Instructor',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
  },
}

describe('loginApi', () => {
  it('posts credentials to the server sign-in endpoint', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:4000/api/v1/auth/sign-in')
      expect(init?.method).toBe('POST')
      expect(init?.credentials).toBe('include')
      const headers = new Headers(init?.headers)

      expect(headers.get('Accept')).toBe('application/json')
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(headers.get('Authorization')).toBeNull()
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

  it('normalizes university-suspended responses to the client-safe suspended message', async () => {
    const fetchMock = async () =>
      Response.json(
        {
          code: 'UNIVERSITY_SUSPENDED',
          message: 'University is suspended',
        },
        {
          status: 403,
        },
      )
    const request = loginApi('user@suspended-uni.edu', 'password', fetchMock)
    const assertion = expect(request).rejects.toMatchObject({
      code: 'UNIVERSITY_SUSPENDED',
      message: UNIVERSITY_SUSPENDED_MESSAGE,
    })

    await assertion
  })

  it('normalizes university-inactive responses to the client-safe inactive message', async () => {
    const fetchMock = async () =>
      Response.json(
        {
          code: 'UNIVERSITY_INACTIVE',
          message: 'University is inactive',
        },
        {
          status: 403,
        },
      )
    const request = loginApi('user@inactive-uni.edu', 'password', fetchMock)
    const assertion = expect(request).rejects.toMatchObject({
      code: 'UNIVERSITY_INACTIVE',
      message: UNIVERSITY_INACTIVE_MESSAGE,
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

  it('does not report an unexpected server failure as invalid credentials', async () => {
    const fetchMock = async () =>
      Response.json(
        { message: 'Internal server error' },
        {
          status: 500,
        },
      )

    await expect(
      loginApi('admin@morshid.demo', 'password', fetchMock),
    ).rejects.toMatchObject({
      message: SIGN_IN_UNAVAILABLE_MESSAGE,
      status: 500,
    })
  })

  it('rejects malformed successful sign-in responses', async () => {
    const fetchMock = async () => Response.json({ user: mockSession.user })

    await expect(
      loginApi('admin@morshid.demo', 'password', fetchMock),
    ).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      message: SIGN_IN_UNAVAILABLE_MESSAGE,
    })
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

describe('logoutApi', () => {
  it('revokes the cookie session through the server logout endpoint', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:4000/api/v1/auth/logout')
      expect(init?.method).toBe('POST')
      expect(init?.credentials).toBe('include')
      const headers = new Headers(init?.headers)

      expect(headers.get('Accept')).toBe('application/json')
      expect(headers.get('Content-Type')).toBeNull()
      expect(headers.get('Authorization')).toBeNull()
      expect(init?.body).toBeUndefined()

      return new Response(null, {
        status: 204,
      })
    }

    await expect(logoutApi(fetchMock)).resolves.toBe(undefined)
  })

  it('rejects when refresh-token revocation fails', async () => {
    const fetchMock = async () =>
      Response.json(
        { message: 'Internal server error' },
        {
          status: 500,
        },
      )

    await expect(logoutApi(fetchMock)).rejects.toMatchObject({
      status: 500,
    })
  })
})

describe('updateOwnProfile', () => {
  it('sends PATCH /me/profile with the updated display name and returns user', async () => {
    const updatedUser = {
      ...mockSession.user,
      displayName: 'Updated Name',
    }

    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:4000/api/v1/me/profile')
      expect(init?.method).toBe('PATCH')
      expect(JSON.parse(String(init?.body))).toEqual({
        displayName: 'Updated Name',
      })

      return Response.json({
        user: updatedUser,
      })
    }

    await expect(
      updateOwnProfile(
        { displayName: 'Updated Name' },
        { fetchImpl: fetchMock },
      ),
    ).resolves.toEqual(updatedUser)
  })
})

describe('changePasswordApi', () => {
  it('sends PATCH /me/password with payload and returns new session', async () => {
    const newSession = {
      ...mockSession,
      accessToken: 'new-access-token',
    }

    const payload = {
      currentPassword: 'old-password-12345',
      newPassword: 'a-brand-new-secure-passphrase-2026',
      confirmation: 'a-brand-new-secure-passphrase-2026',
    }

    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:4000/api/v1/me/password')
      expect(init?.method).toBe('PATCH')
      expect(JSON.parse(String(init?.body))).toEqual(payload)

      return Response.json(newSession)
    }

    await expect(
      changePasswordApi(payload, { fetchImpl: fetchMock }),
    ).resolves.toEqual(newSession)
  })

  it('rejects when server returns an error', async () => {
    const fetchMock = async () =>
      Response.json(
        {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
        { status: 401 },
      )

    await expect(
      changePasswordApi(
        {
          currentPassword: 'wrong-password',
          newPassword: 'a-brand-new-secure-passphrase-2026',
          confirmation: 'a-brand-new-secure-passphrase-2026',
        },
        { fetchImpl: fetchMock },
      ),
    ).rejects.toMatchObject({
      status: 401,
    })
  })
})
