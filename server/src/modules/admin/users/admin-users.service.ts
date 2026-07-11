import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../../auth/auth.dto'
import { AuthUserService } from '../../auth/services/auth-user.service'
import { PasswordHasherService } from '../../auth/services/password-hasher.service'
import type { AuditRequestContext } from '../../audit/audit.service'
import type {
  AdminCreateUserRequest,
  AdminCreateUserResponseDto,
  AdminDisableUserResponseDto,
  AdminReactivateUserResponseDto,
  AdminResetUserPasswordRequest,
  AdminResetUserPasswordResponseDto,
  AdminUserListResponseDto,
} from './admin-users.dto'
import {
  AdminUserEmailAlreadyExistsError,
  adminUserNotFoundException,
  cannotDisableLastActiveAdminException,
  cannotDisableSelfException,
  duplicateAdminUserEmailException,
  unsupportedAdminCreateUserRoleException,
} from './admin-users.errors'
import {
  AdminUsersRepository,
  type AdminListedUserRecord,
  type AdminUserRecord,
} from './admin-users.repository'

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly adminUsersRepository: AdminUsersRepository,
    private readonly passwordHasherService: PasswordHasherService,
    private readonly authUserService: AuthUserService,
  ) {}

  async createUser(
    input: AdminCreateUserRequest,
    actor: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<AdminCreateUserResponseDto> {
    if (input.role === UserRole.ADMIN) {
      throw unsupportedAdminCreateUserRoleException()
    }

    const email = this.authUserService.normalizeEmail(input.email)
    const existingUser = await this.adminUsersRepository.findByEmail(email)

    if (existingUser !== null) {
      throw duplicateAdminUserEmailException(email)
    }

    const passwordHash = this.passwordHasherService.createHash(input.password)

    try {
      const user = await this.adminUsersRepository.createUser({
        email,
        displayName: input.displayName.trim(),
        role: input.role,
        passwordHash,
        actorUserId: actor.id,
        requestContext,
      })

      return {
        user: mapAdminUserRecord(user),
      }
    } catch (error) {
      if (error instanceof AdminUserEmailAlreadyExistsError) {
        throw duplicateAdminUserEmailException(error.email)
      }

      throw error
    }
  }

  async listUsers(): Promise<AdminUserListResponseDto> {
    const users = await this.adminUsersRepository.listUsers()

    return {
      users: users.map(mapAdminListedUserRecord),
    }
  }

  async disableUser(
    userId: string,
    actor: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<AdminDisableUserResponseDto> {
    if (userId === actor.id) {
      throw cannotDisableSelfException()
    }

    const user = await this.adminUsersRepository.findById(userId)

    if (user === null) {
      throw adminUserNotFoundException(userId)
    }

    if (user.status === UserStatus.DISABLED) {
      return {
        user: mapAdminUserRecord(user),
      }
    }

    if (user.role === UserRole.ADMIN) {
      const activeAdminCount =
        await this.adminUsersRepository.countActiveAdmins()

      if (activeAdminCount <= 1) {
        throw cannotDisableLastActiveAdminException()
      }
    }

    const disabledUser = await this.adminUsersRepository.disableUser({
      userId,
      actorUserId: actor.id,
      disabledAt: new Date(),
      requestContext,
    })

    return {
      user: mapAdminUserRecord(disabledUser),
    }
  }

  async reactivateUser(
    userId: string,
    actor: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<AdminReactivateUserResponseDto> {
    const user = await this.adminUsersRepository.findById(userId)

    if (user === null) {
      throw adminUserNotFoundException(userId)
    }

    if (user.status === UserStatus.ACTIVE) {
      return {
        user: mapAdminUserRecord(user),
      }
    }

    const reactivatedUser = await this.adminUsersRepository.reactivateUser({
      userId,
      actorUserId: actor.id,
      requestContext,
    })

    return {
      user: mapAdminUserRecord(reactivatedUser),
    }
  }

  async resetUserPassword(
    userId: string,
    input: AdminResetUserPasswordRequest,
    actor: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<AdminResetUserPasswordResponseDto> {
    const user = await this.adminUsersRepository.findById(userId)

    if (user === null) {
      throw adminUserNotFoundException(userId)
    }

    const passwordHash = this.passwordHasherService.createHash(
      input.newPassword,
    )
    const resetUser = await this.adminUsersRepository.resetUserPassword({
      userId,
      passwordHash,
      passwordChangedAt: new Date(),
      actorUserId: actor.id,
      requestContext,
    })

    return {
      user: mapAdminUserRecord(resetUser),
    }
  }
}

function mapAdminListedUserRecord(user: AdminListedUserRecord) {
  const courses = user.memberships
    .map((membership) => ({
      courseId: membership.courseId,
      code: membership.course.code,
      title: membership.course.title,
      role: membership.role,
    }))
    .sort(compareCourseAssignments)

  return {
    ...mapAdminUserRecord(user),
    courseAssignments: {
      courseCount: courses.length,
      instructorCourseCount: courses.filter(
        (course) => course.role === CourseMembershipRole.INSTRUCTOR,
      ).length,
      studentCourseCount: courses.filter(
        (course) => course.role === CourseMembershipRole.STUDENT,
      ).length,
      courses,
    },
  }
}

function mapAdminUserRecord(user: AdminUserRecord) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

function compareCourseAssignments(
  a: { code: string; role: CourseMembershipRole },
  b: { code: string; role: CourseMembershipRole },
) {
  const codeCompare = a.code.localeCompare(b.code)

  if (codeCompare !== 0) {
    return codeCompare
  }

  return a.role.localeCompare(b.role)
}
