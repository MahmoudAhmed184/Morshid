import { describe, expect, it } from 'vitest'

import { getStudentCourseAccess } from './course-access.api'

describe('getStudentCourseAccess', () => {
  it('loads and validates the authenticated scoped course list', async () => {
    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:4000/api/v1/courses')
      expect(init?.method).toBe('GET')

      return Response.json({
        courses: [
          {
            id: 'python-course',
            code: 'PYTHON-PROG-P0',
            title: 'Python Programming',
            membershipRole: 'STUDENT',
          },
        ],
      })
    }

    await expect(
      getStudentCourseAccess({ fetchImpl: fetchMock }),
    ).resolves.toEqual([
      {
        id: 'python-course',
        code: 'PYTHON-PROG-P0',
        title: 'Python Programming',
        membershipRole: 'STUDENT',
      },
    ])
  })
})
