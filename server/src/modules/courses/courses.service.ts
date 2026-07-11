import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  type UserRole,
  type UserStatus,
} from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import { getCourseRolePolicy } from './course-access.policy'
import { CoursesRepository } from './courses.repository'

export interface CourseListResponse {
  courses: CourseListItem[]
}

export interface CourseListItem {
  id: string
  code: string
  title: string
  membershipRole: CourseMembershipRole | null
  adminMetadata?: CourseAdminMetadata
}

export interface CourseAdminMetadata {
  createdById: string | null
  createdBy: CourseUserSummary | null
  createdAt: string
  updatedAt: string
  memberships: CourseMembershipSummary[]
  memberCount: number
  instructorCount: number
  studentCount: number
  materialCount: number
  activeMaterialCount: number
}

export interface CourseMembershipSummary {
  id: string
  userId: string
  role: CourseMembershipRole
  createdAt: string
  user: CourseUserSummary
}

export interface CourseUserSummary {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: UserStatus
}

@Injectable()
export class CoursesService {
  constructor(private readonly coursesRepository: CoursesRepository) {}

  async listCoursesForUser(
    user: AuthenticatedRequestUser,
  ): Promise<CourseListResponse> {
    const policy = getCourseRolePolicy(user.role)

    if (policy.scope === 'all') {
      return {
        courses: await this.listAdminCourses(),
      }
    }

    return {
      courses: await this.listMemberCourses(user.id, policy.membershipRole),
    }
  }

  private async listAdminCourses(): Promise<CourseListItem[]> {
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
  ): Promise<CourseListItem[]> {
    const courses = await this.coursesRepository.listMemberCourses(userId, role)

    return courses.sort(compareCourseListItems)
  }
}

function compareCourseListItems(a: CourseListItem, b: CourseListItem) {
  return a.code.localeCompare(b.code)
}

function compareCourseMembershipSummaries(
  a: CourseMembershipSummary,
  b: CourseMembershipSummary,
) {
  const roleCompare = a.role.localeCompare(b.role)

  if (roleCompare !== 0) {
    return roleCompare
  }

  return a.user.email.localeCompare(b.user.email)
}
