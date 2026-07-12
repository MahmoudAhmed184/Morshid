import { describe, expect, it } from 'vitest'

import { coursesQueryOptions, getCourses } from './use-course'

const courseId = '4c530c42-67bf-4cbe-a6f3-2c662564ddd1'
const instructorId = 'acace6a5-7430-4dbf-b327-d76f3d51542a'
const membershipId = 'f72891f7-9280-42f1-951c-c45d5d0c4ce5'

describe('getCourses', () => {
  it('loads and validates the admin course list', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:4000/api/v1/admin/courses')
      expect(init?.method).toBe('GET')

      return Response.json({
        courses: [
          {
            id: courseId,
            code: 'PYTHON-PROG-P0',
            title: 'Python Programming',
            adminMetadata: {
              createdById: instructorId,
              createdBy: {
                id: instructorId,
                email: 'instructor@morshid.demo',
                displayName: 'P0 Demo Instructor',
                role: 'INSTRUCTOR',
                status: 'ACTIVE',
              },
              createdAt: '2026-07-01T10:00:00.000Z',
              updatedAt: '2026-07-11T10:00:00.000Z',
              memberships: [
                {
                  id: membershipId,
                  userId: instructorId,
                  role: 'INSTRUCTOR',
                  createdAt: '2026-07-01T10:00:00.000Z',
                  user: {
                    id: instructorId,
                    email: 'instructor@morshid.demo',
                    displayName: 'P0 Demo Instructor',
                    role: 'INSTRUCTOR',
                    status: 'ACTIVE',
                  },
                },
              ],
              memberCount: 1,
              instructorCount: 1,
              studentCount: 0,
              materialCount: 2,
              activeMaterialCount: 2,
            },
          },
        ],
      })
    }

    await expect(getCourses({ fetchImpl: fetchMock })).resolves.toEqual([
      expect.objectContaining({
        id: courseId,
        code: 'PYTHON-PROG-P0',
        title: 'Python Programming',
      }),
    ])
  })
})

describe('coursesQueryOptions', () => {
  it('partitions course data by the authenticated admin', () => {
    expect(coursesQueryOptions('admin-1').queryKey).toEqual([
      'admin',
      'admin-1',
      'courses',
    ])
  })
})
