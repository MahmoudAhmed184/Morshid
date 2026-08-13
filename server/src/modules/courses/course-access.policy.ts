import { UserRole } from '../identity/identity.roles'
import type { UserRole as UserRoleType } from '../identity/identity.roles'
import {
  CourseMembershipRole,
  type CourseMembershipRole as CourseMembershipRoleType,
} from './interface/course-membership-role'

interface AllCoursesPolicy {
  scope: 'all'
  canManage: true
}

interface MembershipCoursesPolicy {
  scope: 'membership'
  membershipRole: CourseMembershipRoleType
  canManage: boolean
}

export type CourseRolePolicy = AllCoursesPolicy | MembershipCoursesPolicy

const COURSE_ROLE_POLICIES: Record<UserRoleType, CourseRolePolicy> = {
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

export function getCourseRolePolicy(role: UserRoleType): CourseRolePolicy {
  return COURSE_ROLE_POLICIES[role]
}
