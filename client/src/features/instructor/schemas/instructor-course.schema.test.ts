import { describe, expect, it } from 'vitest'

import { instructorCourseListSchema } from './instructor-course.schema'

const manageableCourse = {
  id: 'f5bb713c-09b7-42d3-acf3-02f39a902e5a',
  code: 'CS-201',
  title: 'Data Structures',
  membershipRole: 'INSTRUCTOR',
  canManageMaterials: true,
} as const

describe('Instructor material-management course contract', () => {
  it('accepts active Instructor membership capability', () => {
    expect(
      instructorCourseListSchema.parse({ courses: [manageableCourse] }),
    ).toEqual({ courses: [manageableCourse] })
  })

  it('rejects ownership-only or non-Instructor course contexts', () => {
    expect(() =>
      instructorCourseListSchema.parse({
        courses: [{ ...manageableCourse, membershipRole: null }],
      }),
    ).toThrow()
    expect(() =>
      instructorCourseListSchema.parse({
        courses: [{ ...manageableCourse, canManageMaterials: false }],
      }),
    ).toThrow()
  })
})
