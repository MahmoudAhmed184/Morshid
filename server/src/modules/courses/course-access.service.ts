import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  type CourseMembershipRole as CourseMembershipRoleType,
} from './course-membership.types'
import { UserRole } from '../identity/identity.roles'
import type { AuthenticatedUser } from '../identity/identity.types'
import { getCourseRolePolicy } from './course-access.policy'
import { CoursesRepository } from './courses.repository'

export type CourseMaterialManagementAccess =
  | { allowed: true }
  | {
      allowed: false
      reason: 'COURSE_NOT_FOUND' | 'COURSE_MANAGEMENT_REQUIRED'
    }

@Injectable()
export class CourseAccessService {
  constructor(private readonly coursesRepository: CoursesRepository) {}

  async canViewCourse(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<boolean> {
    const policy = getCourseRolePolicy(user.role)

    if (policy.scope === 'all') {
      return true
    }

    return this.hasCourseMembership(user.id, courseId, policy.membershipRole)
  }

  async canManageCourse(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<boolean> {
    const policy = getCourseRolePolicy(user.role)

    if (!policy.canManage) {
      return false
    }

    return this.canViewCourse(user, courseId)
  }

  async authorizeCourseMaterialManagement(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<CourseMaterialManagementAccess> {
    const course = await this.coursesRepository.findCourseAccess(
      user.id,
      courseId,
    )

    if (course === null) {
      return { allowed: false, reason: 'COURSE_NOT_FOUND' }
    }

    if (user.role === UserRole.ADMIN) {
      return { allowed: true }
    }

    if (
      user.role === UserRole.INSTRUCTOR &&
      course.membershipRole === CourseMembershipRole.INSTRUCTOR
    ) {
      return { allowed: true }
    }

    return { allowed: false, reason: 'COURSE_MANAGEMENT_REQUIRED' }
  }

  private async hasCourseMembership(
    userId: string,
    courseId: string,
    expectedRole: CourseMembershipRoleType,
  ) {
    const membershipRole = await this.coursesRepository.findMembershipRole(
      userId,
      courseId,
    )

    return membershipRole === expectedRole
  }
}
