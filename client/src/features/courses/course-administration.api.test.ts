import { describe, expect, it } from 'vitest'

import type { ApiError } from '@/features/auth/session/authenticated-api-client'

import {
  addCourseMember,
  createCourse,
  getCourseAdministration,
  removeCourseMember,
  updateCourse,
  updateCourseMemberRole,
} from './course-administration.api'
import { courseAdministrationQueryOptions } from './course-administration.queries'

const courseId = '4c530c42-67bf-4cbe-a6f3-2c662564ddd1'
const userId = 'acace6a5-7430-4dbf-b327-d76f3d51542a'
const membershipId = 'f72891f7-9280-42f1-951c-c45d5d0c4ce5'
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
const course = {
  id: courseId,
  code: 'CS-201',
  title: 'Data Structures',
  adminMetadata: {
    createdById: null,
    createdBy: null,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-11T10:00:00.000Z',
    memberships: [],
    memberCount: 0,
    instructorCount: 0,
    studentCount: 0,
    materialCount: 0,
    activeMaterialCount: 0,
  },
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

    await expect(
      getCourseAdministration({ fetchImpl: fetchMock }),
    ).resolves.toEqual([expect.objectContaining({ code: 'PYTHON-PROG-P0' })])
  })

  it('adds a course membership through POST', async () => {
    const fetchMock = async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      return Response.json({ member })
    }

    await addCourseMember(
      courseId,
      { userId, role: 'STUDENT' },
      { fetchImpl: fetchMock },
    )
  })

  it('creates a course through POST', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:4000/api/v1/admin/courses')
      expect(init?.method).toBe('POST')
      const headers = new Headers(init?.headers)
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(headers.get('Accept')).toBe('application/json')
      expect(JSON.parse(String(init?.body))).toEqual({
        code: course.code,
        title: course.title,
      })
      return Response.json({ course })
    }

    await expect(
      createCourse(
        { code: course.code, title: course.title },
        { fetchImpl: fetchMock },
      ),
    ).resolves.toEqual(course)
  })

  it('propagates a duplicate course code error from POST', async () => {
    const fetchMock = async () =>
      Response.json(
        { code: 'ADMIN_COURSE_CODE_TAKEN', message: 'Course code is taken' },
        { status: 409 },
      )

    await expect(
      createCourse(
        { code: course.code, title: course.title },
        { fetchImpl: fetchMock },
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({
        status: 409,
        code: 'ADMIN_COURSE_CODE_TAKEN',
        message: 'Course code is taken',
      }),
    )
  })

  it('updates supplied course fields through PATCH', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(
        `http://localhost:4000/api/v1/admin/courses/${courseId}`,
      )
      expect(init?.method).toBe('PATCH')
      const headers = new Headers(init?.headers)
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(headers.get('Accept')).toBe('application/json')
      expect(JSON.parse(String(init?.body))).toEqual({
        title: 'Advanced Data Structures',
      })
      return Response.json({
        course: { ...course, title: 'Advanced Data Structures' },
      })
    }

    await expect(
      updateCourse(
        courseId,
        { title: 'Advanced Data Structures' },
        { fetchImpl: fetchMock },
      ),
    ).resolves.toMatchObject({ title: 'Advanced Data Structures' })
  })

  it('propagates a missing course error from PATCH', async () => {
    const fetchMock = async () =>
      Response.json(
        { code: 'ADMIN_COURSE_NOT_FOUND', message: 'Course not found' },
        { status: 404 },
      )

    await expect(
      updateCourse(courseId, { code: 'CS-999' }, { fetchImpl: fetchMock }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({
        status: 404,
        code: 'ADMIN_COURSE_NOT_FOUND',
        message: 'Course not found',
      }),
    )
  })

  it('rejects a malformed course update response through schema parsing', async () => {
    const fetchMock = async () =>
      Response.json({
        course: { id: course.id, code: course.code, title: course.title },
      })

    await expect(
      updateCourse(
        courseId,
        { title: 'Advanced Data Structures' },
        { fetchImpl: fetchMock },
      ),
    ).rejects.toThrow()
  })

  it('changes a course membership role through PATCH', async () => {
    const fetchMock = async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('PATCH')
      return Response.json({ member: { ...member, role: 'INSTRUCTOR' } })
    }

    await updateCourseMemberRole(courseId, userId, 'INSTRUCTOR', {
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
      removeCourseMember(courseId, userId, { fetchImpl: fetchMock }),
    ).resolves.toBeUndefined()
  })
})

it('partitions course data by authenticated admin', () => {
  expect(courseAdministrationQueryOptions('admin-1').queryKey).toEqual([
    'admin',
    'admin-1',
    'courses',
  ])
})
