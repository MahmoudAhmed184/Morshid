import { ForbiddenException, Injectable } from '@nestjs/common'

import { CourseMembershipRole, UserRole } from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import { getCourseRolePolicy } from './course-access.policy'
import type {
  CourseListItemDto,
  CourseListResponseDto,
  MaterialManageableCourseListResponseDto,
  CourseMembershipSummaryDto,
} from './courses.dto'
import { CoursesRepository } from './courses.repository'

@Injectable()
export class CoursesService {
  constructor(private readonly coursesRepository: CoursesRepository) {}

  async listCoursesForUser(
    user: AuthenticatedRequestUser,
  ): Promise<CourseListResponseDto> {
    const policy = getCourseRolePolicy(user.role)

    if (policy.scope === 'all') {
      return {
        courses: await this.listAdminCourses(),
      }
    }

    if (policy.scope === 'ownership') {
      return {
        courses: await this.listOwnedCourses(user.id),
      }
    }

    return {
      courses: await this.listMemberCourses(user.id, policy.membershipRole),
    }
  }

  async listMaterialManageableCourses(
    user: AuthenticatedRequestUser,
  ): Promise<MaterialManageableCourseListResponseDto> {
    if (user.role !== UserRole.INSTRUCTOR) {
      throw new ForbiddenException(
        'Instructor access is required to manage course materials',
      )
    }

    const courses = await this.listMemberCourses(
      user.id,
      CourseMembershipRole.INSTRUCTOR,
    )

    return {
      courses: courses.map((course) => ({
        id: course.id,
        code: course.code,
        title: course.title,
        membershipRole: course.membershipRole,
        canManageMaterials: true,
      })),
    }
  }

  private async listAdminCourses(): Promise<CourseListItemDto[]> {
    const courses = await this.coursesRepository.listAdminCourses()

    return courses
      .map((course) => {
        const memberships = course.memberships
          .map((membership) => ({
            id: membership.id,
            userId: membership.userId,
            role: membership.role,
            createdAt: membership.createdAt.toISOString(),
            user: membership.user,
          }))
          .sort(compareCourseMembershipSummaries)
        const instructorCount = memberships.filter(
          (membership) => membership.role === CourseMembershipRole.INSTRUCTOR,
        ).length
        const studentCount = memberships.filter(
          (membership) => membership.role === CourseMembershipRole.STUDENT,
        ).length
        const activeMaterialCount = course.materials.filter(
          (material) => material.deletedAt === null,
        ).length

        return {
          id: course.id,
          code: course.code,
          title: course.title,
          membershipRole: null,
          adminMetadata: {
            createdById: course.createdById,
            createdBy: course.createdBy,
            createdAt: course.createdAt.toISOString(),
            updatedAt: course.updatedAt.toISOString(),
            memberships,
            memberCount: memberships.length,
            instructorCount,
            studentCount,
            materialCount: course.materials.length,
            activeMaterialCount,
          },
        }
      })
      .sort(compareCourseListItems)
  }

  private async listMemberCourses(
    userId: string,
    role: CourseMembershipRole,
  ): Promise<CourseListItemDto[]> {
    const courses = await this.coursesRepository.listMemberCourses(userId, role)

    return courses.sort(compareCourseListItems)
  }

  private async listOwnedCourses(userId: string): Promise<CourseListItemDto[]> {
    const courses = await this.coursesRepository.listOwnedCourses(userId)

    return courses.sort(compareCourseListItems)
  }
}

function compareCourseListItems(a: CourseListItemDto, b: CourseListItemDto) {
  return a.code.localeCompare(b.code)
}

function compareCourseMembershipSummaries(
  a: CourseMembershipSummaryDto,
  b: CourseMembershipSummaryDto,
) {
  const roleCompare = a.role.localeCompare(b.role)

  if (roleCompare !== 0) {
    return roleCompare
  }

  return a.user.email.localeCompare(b.user.email)
}
