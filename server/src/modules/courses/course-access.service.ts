import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  UserRole,
  type CourseMembershipRole as CourseMembershipRoleType,
} from '../../generated/prisma/client'
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

  async canManageCourseMaterials(
    user: AuthenticatedRequestUser,
    courseId: string,
  ): Promise<boolean> {
    if (user.role === UserRole.ADMIN) {
      return true
    }

    if (user.role !== UserRole.INSTRUCTOR) {
      return false
    }

    return this.coursesRepository.hasActiveCourseMembership(
      user.id,
      courseId,
      CourseMembershipRole.INSTRUCTOR,
    )
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
