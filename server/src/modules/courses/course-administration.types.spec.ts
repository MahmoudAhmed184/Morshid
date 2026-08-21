import { CourseMembershipRole } from './interface/course-membership-role'
import { resolveCourseMembersRequestSchema } from './course-administration.types'

describe('resolve course members request schema', () => {
  it('accepts email addresses and rejects UUIDs', () => {
    expect(
      resolveCourseMembersRequestSchema.safeParse({
        identifiers: ['student@morshid.demo'],
        role: CourseMembershipRole.STUDENT,
      }).success,
    ).toBe(true)

    expect(
      resolveCourseMembersRequestSchema.safeParse({
        identifiers: ['10000000-0000-4000-8000-000000000001'],
        role: CourseMembershipRole.STUDENT,
      }).success,
    ).toBe(false)
  })
})
