import { Injectable } from '@nestjs/common'

import { CourseMembershipRole, UserRole } from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class CourseAccessService {
  constructor(private readonly prismaService: PrismaService) {}

  async canViewCourse(
    user: AuthenticatedRequestUser,
    courseId: string,
  ): Promise<boolean> {
    switch (user.role) {
      case UserRole.ADMIN:
        return true
      case UserRole.INSTRUCTOR:
        return this.hasCourseMembership(
          user.id,
          courseId,
          CourseMembershipRole.INSTRUCTOR,
        )
      case UserRole.STUDENT:
        return this.hasCourseMembership(
          user.id,
          courseId,
          CourseMembershipRole.STUDENT,
        )
      default:
        return false
    }
  }

  async canManageCourse(
    user: AuthenticatedRequestUser,
    courseId: string,
  ): Promise<boolean> {
    if (user.role === UserRole.ADMIN) {
      return true
    }

    if (user.role === UserRole.INSTRUCTOR) {
      return this.hasCourseMembership(
        user.id,
        courseId,
        CourseMembershipRole.INSTRUCTOR,
      )
    }

    return false
  }

  private async hasCourseMembership(
    userId: string,
    courseId: string,
    role: CourseMembershipRole,
  ) {
    const membership = await this.prismaService.courseMembership.findUnique({
      where: {
        courseId_userId: {
          courseId,
          userId,
        },
      },
      select: {
        role: true,
      },
    })

    return membership?.role === role
  }
}
