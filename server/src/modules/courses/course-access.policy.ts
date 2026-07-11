import { CourseMembershipRole, UserRole } from '../../generated/prisma/client'

interface AllCoursesPolicy {
  scope: 'all'
  canManage: true
}

interface MembershipCoursesPolicy {
  scope: 'membership'
  membershipRole: CourseMembershipRole
  canManage: boolean
}

export type CourseRolePolicy = AllCoursesPolicy | MembershipCoursesPolicy

const COURSE_ROLE_POLICIES: Record<UserRole, CourseRolePolicy> = {
  [UserRole.ADMIN]: {
    scope: 'all',
    canManage: true,
  },
  [UserRole.INSTRUCTOR]: {
    scope: 'membership',
    membershipRole: CourseMembershipRole.INSTRUCTOR,
    canManage: true,
  },
  [UserRole.STUDENT]: {
    scope: 'membership',
    membershipRole: CourseMembershipRole.STUDENT,
    canManage: false,
  },
}

export function getCourseRolePolicy(role: UserRole): CourseRolePolicy {
  return COURSE_ROLE_POLICIES[role]
}
