import { describe, expect, it } from 'vitest'

import type { ApiError } from '@/features/auth/session/interface/authenticated-api-client'

import {
  createManagedUser,
  disableManagedUser,
  getManagedUsers,
  reactivateManagedUser,
  resetManagedUserPassword,
  updateManagedUser,
} from './user-management.api'

const userId = '4c530c42-67bf-4cbe-a6f3-2c662564ddd1'
const courseId = 'acace6a5-7430-4dbf-b327-d76f3d51542a'

const managedUser = {
  id: userId,
  email: 'student@morshid.demo',
  displayName: 'Demo Student',
  role: 'STUDENT',
  status: 'ACTIVE',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-11T10:00:00.000Z',
  courseAssignments: {
    courseCount: 1,
    instructorCourseCount: 0,
    studentCourseCount: 1,
    courses: [
      {
        courseId,
        code: 'PYTHON-PROG-P0',
        title: 'Python Programming',
        role: 'STUDENT',
      },
    ],
  },
}

const userResponse = {
  id: managedUser.id,
  email: managedUser.email,
  displayName: managedUser.displayName,
  role: managedUser.role,
  status: managedUser.status,
  createdAt: managedUser.createdAt,
  updatedAt: managedUser.updatedAt,
}

describe('admin users API', () => {
  it('creates a student or instructor through the POST endpoint', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:4000/api/v1/admin/users')
      expect(init?.method).toBe('POST')
      expect(JSON.parse(String(init?.body))).toEqual({
        email: userResponse.email,
        displayName: userResponse.displayName,
        password: 'StrongPassword123!',
        role: 'STUDENT',
      })

      return Response.json({ user: userResponse })
    }

    await expect(
      createManagedUser(
        {
          email: userResponse.email,
          displayName: userResponse.displayName,
          password: 'StrongPassword123!',
          role: 'STUDENT',
        },
        { fetchImpl: fetchMock },
      ),
    ).resolves.toEqual(userResponse)
  })

  it('loads a cursor page of users from the server', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(
        `http://localhost:4000/api/v1/admin/users?limit=1&cursor=${userId}`,
      )
      expect(init?.method).toBe('GET')

      return Response.json({ users: [managedUser] })
    }

    await expect(
      getManagedUsers({ cursor: userId, limit: 1 }, { fetchImpl: fetchMock }),
    ).resolves.toEqual({ users: [managedUser] })
  })

  it('resets a user password through the PATCH endpoint', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(
        `http://localhost:4000/api/v1/admin/users/${userId}/reset-password`,
      )
      expect(init?.method).toBe('PATCH')
      expect(JSON.parse(String(init?.body))).toEqual({
        newPassword: 'StrongPassword123!',
      })

      return Response.json({ user: userResponse })
    }

    await expect(
      resetManagedUserPassword(userId, 'StrongPassword123!', {
        fetchImpl: fetchMock,
      }),
    ).resolves.toEqual(userResponse)
  })

  it.each([
    ['disable', disableManagedUser],
    ['reactivate', reactivateManagedUser],
  ] as const)('calls the %s PATCH endpoint', async (action, request) => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(
        `http://localhost:4000/api/v1/admin/users/${userId}/${action}`,
      )
      expect(init?.method).toBe('PATCH')

      return Response.json({ user: userResponse })
    }

    await expect(request(userId, { fetchImpl: fetchMock })).resolves.toEqual(
      userResponse,
    )
  })

  it('updates only the supplied user fields through PATCH', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(
        `http://localhost:4000/api/v1/admin/users/${userId}`,
      )
      expect(init?.method).toBe('PATCH')
      const headers = new Headers(init?.headers)
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(headers.get('Accept')).toBe('application/json')
      expect(JSON.parse(String(init?.body))).toEqual({
        displayName: 'Updated Student',
      })

      return Response.json({
        user: { ...userResponse, displayName: 'Updated Student' },
      })
    }

    await expect(
      updateManagedUser(
        userId,
        { displayName: 'Updated Student' },
        { fetchImpl: fetchMock },
      ),
    ).resolves.toMatchObject({ displayName: 'Updated Student' })
  })

  it('sends every supplied identity field on a user update', async () => {
    const fetchMock = async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        displayName: 'Updated Student',
        email: 'updated@morshid.demo',
        role: 'INSTRUCTOR',
      })

      return Response.json({
        user: {
          ...userResponse,
          displayName: 'Updated Student',
          email: 'updated@morshid.demo',
          role: 'INSTRUCTOR',
        },
      })
    }

    await expect(
      updateManagedUser(
        userId,
        {
          displayName: 'Updated Student',
          email: 'updated@morshid.demo',
          role: 'INSTRUCTOR',
        },
        { fetchImpl: fetchMock },
      ),
    ).resolves.toMatchObject({
      email: 'updated@morshid.demo',
      role: 'INSTRUCTOR',
    })
  })

  it('propagates a conflicting email error from the user PATCH endpoint', async () => {
    const fetchMock = async () =>
      Response.json(
        { code: 'ADMIN_USER_EMAIL_TAKEN', message: 'Email already in use' },
        { status: 409 },
      )

    await expect(
      updateManagedUser(
        userId,
        { email: 'taken@morshid.demo' },
        { fetchImpl: fetchMock },
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({
        status: 409,
        code: 'ADMIN_USER_EMAIL_TAKEN',
        message: 'Email already in use',
      }),
    )
  })

  it('rejects a malformed user update response through schema parsing', async () => {
    const fetchMock = async () =>
      Response.json({ user: { ...userResponse, role: 'SUPERUSER' } })

    await expect(
      updateManagedUser(
        userId,
        { displayName: 'Updated Student' },
        { fetchImpl: fetchMock },
      ),
    ).rejects.toThrow()
  })
})
