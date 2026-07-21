import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  type Prisma,
  type UserRole,
  type UserStatus,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const courseUserSummarySelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  status: true,
} satisfies Prisma.UserSelect

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
  membershipRole: CourseMembershipRole | null
}

export abstract class CoursesRepository {
  abstract findMembershipRole(
    userId: string,
    courseId: string,
  ): Promise<CourseMembershipRole | null>

  abstract isCourseOwner(userId: string, courseId: string): Promise<boolean>

  abstract hasActiveCourseMembership(
    userId: string,
    courseId: string,
    role: CourseMembershipRole,
  ): Promise<boolean>

  abstract listAdminCourses(): Promise<AdminCourseRecord[]>

  abstract listMemberCourses(
    userId: string,
    role: CourseMembershipRole,
  ): Promise<MemberCourseRecord[]>

  abstract listOwnedCourses(userId: string): Promise<MemberCourseRecord[]>
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

  async isCourseOwner(userId: string, courseId: string) {
    const course = await this.prismaService.course.findFirst({
      where: {
        id: courseId,
        createdById: userId,
      },
      select: {
        id: true,
      },
    })

    return course !== null
  }

  async hasActiveCourseMembership(
    userId: string,
    courseId: string,
    role: CourseMembershipRole,
  ) {
    const membership = await this.prismaService.courseMembership.findFirst({
      where: {
        courseId,
        userId,
        role,
        removedAt: null,
      },
      select: {
        id: true,
      },
    })

    return membership !== null
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
          select: courseUserSummarySelect,
        },
        memberships: {
          select: {
            id: true,
            userId: true,
            role: true,
            createdAt: true,
            user: {
              select: courseUserSummarySelect,
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

  async listOwnedCourses(userId: string): Promise<MemberCourseRecord[]> {
    const courses = await this.prismaService.course.findMany({
      where: {
        createdById: userId,
      },
      select: {
        id: true,
        code: true,
        title: true,
        memberships: {
          where: {
            userId,
          },
          select: {
            role: true,
          },
          take: 1,
        },
      },
    })

    return courses.map((course) => ({
      id: course.id,
      code: course.code,
      title: course.title,
      membershipRole: course.memberships[0]?.role ?? null,
    }))
  }
}
