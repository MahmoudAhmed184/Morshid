import { describe, expect, it, vi } from 'vitest'

import { getInstructorCourses } from './instructor-dashboard.api'

describe('Instructor dashboard API', () => {
  it('loads only server-authorized material-management course contexts', async () => {
    const response = {
      courses: [
        {
          id: 'f5bb713c-09b7-42d3-acf3-02f39a902e5a',
          code: 'CS-201',
          title: 'Data Structures',
          membershipRole: 'INSTRUCTOR',
          canManageMaterials: true,
        },
      ],
    }
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          'http://localhost:4000/api/v1/courses/material-management',
        )
        expect(init?.method).toBe('GET')

        return Response.json(response)
      },
    )

    await expect(
      getInstructorCourses({ fetchImpl: fetchMock }),
    ).resolves.toEqual(response.courses)
  })
})
