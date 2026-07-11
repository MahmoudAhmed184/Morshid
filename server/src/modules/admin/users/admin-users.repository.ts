import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  Prisma,
  UserRole,
  UserStatus,
} from '../../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuditRequestContext } from '../../audit/audit.service'
import type { AdminCreatableUserRole } from './admin-users.dto'
import { AdminUsersAuditService } from './admin-users.audit.service'
import { AdminUserEmailAlreadyExistsError } from './admin-users.errors'

export interface AdminUserRecord {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: UserStatus
  createdAt: Date
  updatedAt: Date
}

export interface AdminUserCourseAssignmentRecord {
  courseId: string
  role: CourseMembershipRole
  course: {
    id: string
    code: string
    title: string
  }
}

export interface AdminListedUserRecord extends AdminUserRecord {
  memberships: AdminUserCourseAssignmentRecord[]
}

export interface CreateAdminUserRepositoryInput {
  email: string
  displayName: string
  role: AdminCreatableUserRole
  passwordHash: string
  actorUserId: string
  requestContext?: AuditRequestContext
}

export interface DisableAdminUserRepositoryInput {
  userId: string
  actorUserId: string
  disabledAt: Date
  requestContext?: AuditRequestContext
}

const adminUserRecordSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

const adminListedUserRecordSelect = {
  ...adminUserRecordSelect,
  memberships: {
    select: {
      courseId: true,
      role: true,
      course: {
        select: {
          id: true,
          code: true,
          title: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect

export abstract class AdminUsersRepository {
  abstract findByEmail(email: string): Promise<AdminUserRecord | null>

  abstract findById(userId: string): Promise<AdminUserRecord | null>

  abstract listUsers(): Promise<AdminListedUserRecord[]>

  abstract countActiveAdmins(): Promise<number>

  abstract createUser(
    input: CreateAdminUserRepositoryInput,
  ): Promise<AdminUserRecord>

  abstract disableUser(
    input: DisableAdminUserRepositoryInput,
  ): Promise<AdminUserRecord>
}

@Injectable()
export class PrismaAdminUsersRepository extends AdminUsersRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly adminUsersAuditService: AdminUsersAuditService,
  ) {
    super()
  }

  findByEmail(email: string): Promise<AdminUserRecord | null> {
    return this.prismaService.user.findUnique({
      where: {
        email,
      },
      select: adminUserRecordSelect,
    })
  }

  findById(userId: string): Promise<AdminUserRecord | null> {
    return this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      select: adminUserRecordSelect,
    })
  }

  listUsers(): Promise<AdminListedUserRecord[]> {
    return this.prismaService.user.findMany({
      select: adminListedUserRecordSelect,
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  countActiveAdmins(): Promise<number> {
    return this.prismaService.user.count({
      where: {
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    })
  }

  async createUser(
    input: CreateAdminUserRepositoryInput,
  ): Promise<AdminUserRecord> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: input.email,
            displayName: input.displayName,
            role: input.role,
            status: UserStatus.ACTIVE,
            passwordHash: input.passwordHash,
          },
          select: adminUserRecordSelect,
        })

        await this.adminUsersAuditService.recordUserCreated(
          {
            actorUserId: input.actorUserId,
            targetUser: user,
            requestContext: input.requestContext,
          },
          tx,
        )

        return user
      })
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new AdminUserEmailAlreadyExistsError(input.email)
      }

      throw error
    }
  }

  disableUser(
    input: DisableAdminUserRepositoryInput,
  ): Promise<AdminUserRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: {
          id: input.userId,
        },
        data: {
          status: UserStatus.DISABLED,
          disabledAt: input.disabledAt,
          disabledById: input.actorUserId,
        },
        select: adminUserRecordSelect,
      })

      const revokedRefreshTokens = await tx.refreshToken.updateMany({
        where: {
          userId: input.userId,
          revokedAt: null,
          expiresAt: {
            gt: input.disabledAt,
          },
        },
        data: {
          revokedAt: input.disabledAt,
        },
      })

      await this.adminUsersAuditService.recordUserDisabled(
        {
          actorUserId: input.actorUserId,
          targetUser: user,
          revokedRefreshTokenCount: revokedRefreshTokens.count,
          requestContext: input.requestContext,
        },
        tx,
      )

      return user
    })
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}
