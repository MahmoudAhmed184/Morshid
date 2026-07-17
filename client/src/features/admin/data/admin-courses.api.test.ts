import { describe, expect, it } from 'vitest'

import {
  addAdminCourseMember,
  getAdminCourses,
  removeAdminCourseMember,
  updateAdminCourseMemberRole,
  updateAdminMaterial,
} from './admin-courses.api'
import { adminCoursesQueryOptions } from './admin-courses.queries'

const courseId = '4c530c42-67bf-4cbe-a6f3-2c662564ddd1'
const userId = 'acace6a5-7430-4dbf-b327-d76f3d51542a'
const membershipId = 'f72891f7-9280-42f1-951c-c45d5d0c4ce5'
const materialId = 'c6432e4c-69b0-42c6-a778-70c54f684720'
const user = {
  id: userId,
  email: 'student@morshid.demo',
  displayName: 'Demo Student',
  role: 'STUDENT',
  status: 'ACTIVE',
}
const member = {
  id: membershipId,
  userId,
  role: 'STUDENT',
  createdAt: '2026-07-01T10:00:00.000Z',
  user,
}

describe('admin course API', () => {
  it('loads and validates the P0 course list', async () => {
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
              createdById: null,
              createdBy: null,
              createdAt: '2026-07-01T10:00:00.000Z',
              updatedAt: '2026-07-11T10:00:00.000Z',
              memberships: [member],
              memberCount: 1,
              instructorCount: 0,
              studentCount: 1,
              materialCount: 1,
              activeMaterialCount: 1,
            },
          },
        ],
      })
    }

    await expect(getAdminCourses({ fetchImpl: fetchMock })).resolves.toEqual([
      expect.objectContaining({ code: 'PYTHON-PROG-P0' }),
    ])
  })

  it('adds a course membership through POST', async () => {
    const fetchMock = async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      return Response.json({ member })
    }

    await addAdminCourseMember(
      courseId,
      { userId, role: 'STUDENT' },
      { fetchImpl: fetchMock },
    )
  })

  it('changes a course membership role through PATCH', async () => {
    const fetchMock = async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('PATCH')
      return Response.json({ member: { ...member, role: 'INSTRUCTOR' } })
    }

    await updateAdminCourseMemberRole(courseId, userId, 'INSTRUCTOR', {
      fetchImpl: fetchMock,
    })
  })

  it('removes a membership through DELETE', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain(`/members/${userId}`)
      expect(init?.method).toBe('DELETE')
      return new Response(null, { status: 204 })
    }

    await expect(
      removeAdminCourseMember(courseId, userId, { fetchImpl: fetchMock }),
    ).resolves.toBeUndefined()
  })

  it('updates material metadata with the live PATCH contract', async () => {
    const fetchMock = async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('PATCH')
      expect(JSON.parse(String(init?.body))).toEqual({ title: 'Week 1' })
      return Response.json({
        material: {
          id: materialId,
          courseId,
          uploadedById: userId,
          uploadedBy: user,
          title: 'Week 1',
          originalFilename: 'week-1.pdf',
          storagePath: 'courses/week-1.pdf',
          sha256Hash: null,
          status: 'READY',
          extractedTextLength: 100,
          chunkCount: 2,
          errorMessage: null,
          createdAt: '2026-07-01T10:00:00.000Z',
          updatedAt: '2026-07-11T10:00:00.000Z',
        },
      })
    }

    await expect(
      updateAdminMaterial(courseId, materialId, 'Week 1', {
        fetchImpl: fetchMock,
      }),
    ).resolves.toMatchObject({ title: 'Week 1', status: 'READY' })
  })
})

it('partitions course data by authenticated admin', () => {
  expect(adminCoursesQueryOptions('admin-1').queryKey).toEqual([
    'admin',
    'admin-1',
    'courses',
  ])
})
