import { Injectable } from '@nestjs/common'

import type { User } from '../../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type {
  AuthCourseSummary,
  AuthenticatedRequestUser,
  AuthUserSummary,
} from '../auth.dto'

@Injectable()
export class AuthUserService {
  constructor(private readonly prismaService: PrismaService) {}

  normalizeEmail(email: string) {
    return email.trim().toLowerCase()
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: {
        email: this.normalizeEmail(email),
      },
    })
  }

  findById(userId: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    })
  }

  async findActiveUserById(
    userId: string,
  ): Promise<AuthenticatedRequestUser | null> {
    const user = await this.findById(userId)

    if (!user || this.isDisabled(user)) {
      return null
    }

    return this.pickAuthenticatedUser(user)
  }

  isDisabled(user: Pick<User, 'status'>) {
    return user.status === 'DISABLED'
  }

  async recordLastLogin(user: Pick<User, 'id'>, now: Date): Promise<void> {
    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: now,
      },
    })
  }

  pickAuthenticatedUser(user: User): AuthenticatedRequestUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    }
  }

  async buildUserSummary(
    user: AuthenticatedRequestUser | User,
  ): Promise<AuthUserSummary> {
    const courses =
      user.role === 'ADMIN'
        ? await this.listAdminCourseSummaries(user.id)
        : await this.listMemberCourseSummaries(user.id)

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      courses,
    }
  }

  private async listAdminCourseSummaries(
    userId: string,
  ): Promise<AuthCourseSummary[]> {
    const courses = await this.prismaService.course.findMany({
      include: {
        memberships: {
          where: {
            userId,
          },
        },
      },
    })

    return courses
      .map((course) => ({
        id: course.id,
        code: course.code,
        title: course.title,
        membershipRole: course.memberships[0]?.role ?? null,
      }))
      .sort(compareCourses)
  }

  private async listMemberCourseSummaries(
    userId: string,
  ): Promise<AuthCourseSummary[]> {
    const memberships = await this.prismaService.courseMembership.findMany({
      where: {
        userId,
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
      .sort(compareCourses)
  }
}

function compareCourses(a: AuthCourseSummary, b: AuthCourseSummary) {
  return a.code.localeCompare(b.code)
}
