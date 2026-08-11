import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  Prisma,
  UserRole,
  UserStatus,
} from '../../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuditRequestContext } from '../../audit/audit.service'
import type { CreatableUserRole } from './user-administration.types'
import { UserAdministrationAuditService } from './user-administration-audit'
import {
  ManagedUserEmailAlreadyExistsError,
  ManagedUserNotFoundError,
  ManagedUserRoleChangeHasMembershipsError,
  CannotDisableLastActiveAdminError,
} from './user-administration.errors'

export interface ManagedUserRecord {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: UserStatus
  createdAt: Date
  updatedAt: Date
}

export interface ManagedUserCourseAssignmentRecord {
  courseId: string
  role: CourseMembershipRole
  course: {
    id: string
    code: string
    title: string
  }
}

export interface ListedUserRecord extends ManagedUserRecord {
  memberships: ManagedUserCourseAssignmentRecord[]
}

export interface ListUserAdministrationRepositoryInput {
  limit: number
  cursor?: string
}

export interface ListedUsersPage {
  users: ListedUserRecord[]
  nextCursor?: string
}

export interface CreateManagedUserRepositoryInput {
  email: string
  displayName: string
  role: CreatableUserRole
  passwordHash: string
  actorUserId: string
  requestContext?: AuditRequestContext
}

export interface UpdateManagedUserRepositoryInput {
  userId: string
  email?: string
  displayName?: string
  role?: CreatableUserRole
  actorUserId: string
  requestContext?: AuditRequestContext
}

export interface DisableManagedUserRepositoryInput {
  userId: string
  actorUserId: string
  disabledAt: Date
  requestContext?: AuditRequestContext
}

export interface ReactivateManagedUserRepositoryInput {
  userId: string
  actorUserId: string
  requestContext?: AuditRequestContext
}

export interface ResetManagedUserPasswordRepositoryInput {
  userId: string
  passwordHash: string
  passwordChangedAt: Date
  actorUserId: string
  requestContext?: AuditRequestContext
}

const userRecordSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

const listedUserRecordSelect = {
  ...userRecordSelect,
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

export abstract class UserAdministrationRepository {
  abstract findByEmail(email: string): Promise<ManagedUserRecord | null>

  abstract findById(userId: string): Promise<ManagedUserRecord | null>

  abstract listUsers(
    input: ListUserAdministrationRepositoryInput,
  ): Promise<ListedUsersPage>

  abstract createUser(
    input: CreateManagedUserRepositoryInput,
  ): Promise<ManagedUserRecord>

  abstract updateUser(
    input: UpdateManagedUserRepositoryInput,
  ): Promise<ManagedUserRecord>

  abstract disableUser(
    input: DisableManagedUserRepositoryInput,
  ): Promise<ManagedUserRecord>

  abstract reactivateUser(
    input: ReactivateManagedUserRepositoryInput,
  ): Promise<ManagedUserRecord>

  abstract resetUserPassword(
    input: ResetManagedUserPasswordRepositoryInput,
  ): Promise<ManagedUserRecord>
}

@Injectable()
export class PrismaUserAdministrationRepository extends UserAdministrationRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userAdministrationAuditService: UserAdministrationAuditService,
  ) {
    super()
  }

  findByEmail(email: string): Promise<ManagedUserRecord | null> {
    return this.prismaService.user.findUnique({
      where: {
        email,
      },
      select: userRecordSelect,
    })
  }

  findById(userId: string): Promise<ManagedUserRecord | null> {
    return this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      select: userRecordSelect,
    })
  }

  async listUsers(
    input: ListUserAdministrationRepositoryInput,
  ): Promise<ListedUsersPage> {
    const users = await this.prismaService.user.findMany({
      select: listedUserRecordSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.cursor === undefined
        ? {}
        : { cursor: { id: input.cursor }, skip: 1 }),
    })

    const hasNextPage = users.length > input.limit
    const pageUsers = hasNextPage ? users.slice(0, input.limit) : users
    const nextCursor = hasNextPage ? pageUsers.at(-1)?.id : undefined

    return {
      users: pageUsers,
      ...(nextCursor === undefined ? {} : { nextCursor }),
    }
  }

  async createUser(
    input: CreateManagedUserRepositoryInput,
  ): Promise<ManagedUserRecord> {
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
          select: userRecordSelect,
        })

        await this.userAdministrationAuditService.recordUserCreated(
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
        throw new ManagedUserEmailAlreadyExistsError(input.email)
      }

      throw error
    }
  }

  async updateUser(
    input: UpdateManagedUserRepositoryInput,
  ): Promise<ManagedUserRecord> {
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
          const currentUser = await tx.user.findUnique({
            where: { id: input.userId },
            select: userRecordSelect,
          })

          if (currentUser === null) {
            throw new ManagedUserNotFoundError(input.userId)
          }

          if (input.role !== undefined && input.role !== currentUser.role) {
            const activeMembership = await tx.courseMembership.findFirst({
              where: {
                userId: input.userId,
                removedAt: null,
              },
              select: { id: true },
            })

            if (activeMembership !== null) {
              throw new ManagedUserRoleChangeHasMembershipsError(input.userId)
            }
          }

          const user = await tx.user.update({
            where: {
              id: input.userId,
            },
            data: {
              email: input.email,
              displayName: input.displayName,
              role: input.role,
            },
            select: userRecordSelect,
          })

          await this.userAdministrationAuditService.recordUserUpdated(
            {
              actorUserId: input.actorUserId,
              previousUser: currentUser,
              targetUser: user,
              requestContext: input.requestContext,
            },
            tx,
          )

          return user
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      )
    } catch (error) {
      if (isUniqueConstraintViolation(error) && input.email !== undefined) {
        throw new ManagedUserEmailAlreadyExistsError(input.email)
      }

      throw error
    }
  }

  async disableUser(
    input: DisableManagedUserRepositoryInput,
  ): Promise<ManagedUserRecord> {
    const target = await this.prismaService.user.findUnique({
      where: { id: input.userId },
      select: { role: true },
    })
    const protectsActiveAdmins = target?.role === UserRole.ADMIN

    return this.prismaService.$transaction(
      async (tx) => {
        const lockedActiveAdmins = protectsActiveAdmins
          ? await lockActiveAdmins(tx)
          : null
        const findCurrentUser = () =>
          tx.user.findUnique({
            where: {
              id: input.userId,
            },
            select: userRecordSelect,
          })
        const currentUser = await findCurrentUser()

        if (currentUser === null) {
          throw new ManagedUserNotFoundError(input.userId)
        }

        if (currentUser.status === UserStatus.DISABLED) {
          return currentUser
        }

        if (currentUser.role === UserRole.ADMIN) {
          const activeAdminCount = lockedActiveAdmins?.length ?? 0

          if (activeAdminCount <= 1) {
            throw new CannotDisableLastActiveAdminError()
          }
        }

        const user = await tx.user.update({
          where: {
            id: input.userId,
          },
          data: {
            status: UserStatus.DISABLED,
            disabledAt: input.disabledAt,
            disabledById: input.actorUserId,
          },
          select: userRecordSelect,
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

        await this.userAdministrationAuditService.recordUserDisabled(
          {
            actorUserId: input.actorUserId,
            targetUser: user,
            revokedRefreshTokenCount: revokedRefreshTokens.count,
            requestContext: input.requestContext,
          },
          tx,
        )

        return user
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    )
  }

  reactivateUser(
    input: ReactivateManagedUserRepositoryInput,
  ): Promise<ManagedUserRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: {
          id: input.userId,
        },
        data: {
          status: UserStatus.ACTIVE,
          disabledAt: null,
          disabledById: null,
        },
        select: userRecordSelect,
      })

      await this.userAdministrationAuditService.recordUserReactivated(
        {
          actorUserId: input.actorUserId,
          targetUser: user,
          requestContext: input.requestContext,
        },
        tx,
      )

      return user
    })
  }

  resetUserPassword(
    input: ResetManagedUserPasswordRepositoryInput,
  ): Promise<ManagedUserRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: {
          id: input.userId,
        },
        data: {
          passwordHash: input.passwordHash,
          passwordChangedAt: input.passwordChangedAt,
        },
        select: userRecordSelect,
      })

      const revokedRefreshTokens = await tx.refreshToken.updateMany({
        where: {
          userId: input.userId,
          revokedAt: null,
          expiresAt: {
            gt: input.passwordChangedAt,
          },
        },
        data: {
          revokedAt: input.passwordChangedAt,
        },
      })

      await this.userAdministrationAuditService.recordUserPasswordReset(
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

async function lockActiveAdmins(
  transaction: Prisma.TransactionClient,
): Promise<{ id: string }[]> {
  return transaction.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM users
    WHERE role = 'ADMIN'::user_role
      AND status = 'ACTIVE'::user_status
    ORDER BY id
    FOR UPDATE
  `
}
