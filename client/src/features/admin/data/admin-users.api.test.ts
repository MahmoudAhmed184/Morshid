import { describe, expect, it } from 'vitest'

import {
  disableAdminUser,
  getAdminUsers,
  reactivateAdminUser,
  resetAdminUserPassword,
} from './admin-users.api'

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
  it('loads a cursor page of users from the server', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(
        `http://localhost:4000/api/v1/admin/users?limit=1&cursor=${userId}`,
      )
      expect(init?.method).toBe('GET')

      return Response.json({ users: [managedUser] })
    }

    await expect(
      getAdminUsers({ cursor: userId, limit: 1 }, { fetchImpl: fetchMock }),
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
      resetAdminUserPassword(userId, 'StrongPassword123!', {
        fetchImpl: fetchMock,
      }),
    ).resolves.toEqual(userResponse)
  })

  it.each([
    ['disable', disableAdminUser],
    ['reactivate', reactivateAdminUser],
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
})
