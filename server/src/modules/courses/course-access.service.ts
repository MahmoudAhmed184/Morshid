import { Injectable } from '@nestjs/common'

import type { CourseMembershipRole } from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import { getCourseRolePolicy } from './course-access.policy'
import { CoursesRepository } from './courses.repository'

@Injectable()
export class CourseAccessService {
  constructor(private readonly coursesRepository: CoursesRepository) {}

  async canViewCourse(
    user: AuthenticatedRequestUser,
    courseId: string,
  ): Promise<boolean> {
    const policy = getCourseRolePolicy(user.role)

    if (policy.scope === 'all') {
      return true
    }

    if (policy.scope === 'ownership') {
      return this.coursesRepository.isCourseOwner(user.id, courseId)
    }

    return this.hasCourseMembership(user.id, courseId, policy.membershipRole)
  }

  async canManageCourse(
    user: AuthenticatedRequestUser,
    courseId: string,
  ): Promise<boolean> {
    const policy = getCourseRolePolicy(user.role)

    if (!policy.canManage) {
      return false
    }

    return this.canViewCourse(user, courseId)
  }

  private async hasCourseMembership(
    userId: string,
    courseId: string,
    expectedRole: CourseMembershipRole,
  ) {
    const membershipRole = await this.coursesRepository.findMembershipRole(
      userId,
      courseId,
    )

    return membershipRole === expectedRole
  }
}
