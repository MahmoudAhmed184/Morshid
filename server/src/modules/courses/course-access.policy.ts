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

interface OwnedCoursesPolicy {
  scope: 'ownership'
  canManage: true
}

export type CourseRolePolicy =
  AllCoursesPolicy | OwnedCoursesPolicy | MembershipCoursesPolicy

const COURSE_ROLE_POLICIES: Record<UserRole, CourseRolePolicy> = {
  [UserRole.ADMIN]: {
    scope: 'all',
    canManage: true,
  },
  [UserRole.INSTRUCTOR]: {
    scope: 'ownership',
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
