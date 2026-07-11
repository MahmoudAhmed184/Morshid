import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  type UserRole,
  type UserStatus,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export interface CourseUserRecord {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: UserStatus
}

export interface CourseMembershipRecord {
  id: string
  userId: string
  role: CourseMembershipRole
  createdAt: Date
  user: CourseUserRecord
}

export interface AdminCourseRecord {
  id: string
  code: string
  title: string
  createdById: string | null
  createdBy: CourseUserRecord | null
  createdAt: Date
  updatedAt: Date
  memberships: CourseMembershipRecord[]
  materials: { deletedAt: Date | null }[]
}

export interface MemberCourseRecord {
  id: string
  code: string
  title: string
  membershipRole: CourseMembershipRole
}

export abstract class CoursesRepository {
  abstract findMembershipRole(
    userId: string,
    courseId: string,
  ): Promise<CourseMembershipRole | null>

  abstract listAdminCourses(): Promise<AdminCourseRecord[]>

  abstract listMemberCourses(
    userId: string,
    role: CourseMembershipRole,
  ): Promise<MemberCourseRecord[]>
}

@Injectable()
export class PrismaCoursesRepository extends CoursesRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async findMembershipRole(userId: string, courseId: string) {
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

    return membership?.role ?? null
  }

  listAdminCourses(): Promise<AdminCourseRecord[]> {
    return this.prismaService.course.findMany({
      select: {
        id: true,
        code: true,
        title: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
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
          select: {
            id: true,
            userId: true,
            role: true,
            createdAt: true,
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
  }

  async listMemberCourses(
    userId: string,
    role: CourseMembershipRole,
  ): Promise<MemberCourseRecord[]> {
    const memberships = await this.prismaService.courseMembership.findMany({
      where: {
        userId,
        role,
      },
      select: {
        role: true,
        course: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
      },
    })

    return memberships.map((membership) => ({
      ...membership.course,
      membershipRole: membership.role,
    }))
  }
}
