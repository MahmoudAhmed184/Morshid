import { describe, expect, it } from 'vitest'

import { courseMembershipListSchema } from './course-membership.schema'

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
      courseMembershipListSchema.parse({ courses: [manageableCourse] }),
    ).toEqual({ courses: [manageableCourse] })
  })

  it('rejects ownership-only or non-Instructor course contexts', () => {
    expect(() =>
      courseMembershipListSchema.parse({
        courses: [{ ...manageableCourse, membershipRole: null }],
      }),
    ).toThrow()
    expect(() =>
      courseMembershipListSchema.parse({
        courses: [{ ...manageableCourse, canManageMaterials: false }],
      }),
    ).toThrow()
  })
})
