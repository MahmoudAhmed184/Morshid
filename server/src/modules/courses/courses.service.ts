import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  UserRole,
  type UserStatus,
} from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import { PrismaService } from '../prisma/prisma.service'

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
  constructor(private readonly prismaService: PrismaService) {}

  async listCoursesForUser(
    user: AuthenticatedRequestUser,
  ): Promise<CourseListResponse> {
    switch (user.role) {
      case UserRole.ADMIN:
        return {
          courses: await this.listAdminCourses(),
        }
      case UserRole.INSTRUCTOR:
        return {
          courses: await this.listMemberCourses(
            user.id,
            CourseMembershipRole.INSTRUCTOR,
          ),
        }
      case UserRole.STUDENT:
        return {
          courses: await this.listMemberCourses(
            user.id,
            CourseMembershipRole.STUDENT,
          ),
        }
      default:
        return {
          courses: [],
        }
    }
  }

  private async listAdminCourses(): Promise<CourseListItem[]> {
    const courses = await this.prismaService.course.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            status: true,
          },
        },
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                status: true,
              },
            },
          },
        },
        materials: {
          select: {
            deletedAt: true,
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    })

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
    const memberships = await this.prismaService.courseMembership.findMany({
      where: {
        userId,
        role,
      },
      include: {
        course: true,
      },
    })

    return memberships
      .map((membership) => ({
        id: membership.course.id,
        code: membership.course.code,
        title: membership.course.title,
        membershipRole: membership.role,
      }))
      .sort(compareCourseListItems)
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
