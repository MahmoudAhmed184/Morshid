import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../../../generated/prisma/client'
import type { AuthenticatedUser } from '../../identity/identity.types'
import { IdentityUser } from '../../identity/identity-user'
import { PasswordHasher } from '../../identity/password-hasher'
import type { AuditRequestContext } from '../../audit/audit.public'
import type {
  CreateUserRequest,
  CreateUserResponseDto,
  DisableUserResponseDto,
  ReactivateUserResponseDto,
  ResetUserPasswordRequest,
  ResetUserPasswordResponseDto,
  UpdateUserRequest,
  UpdateUserResponseDto,
  ManagedUserListResponseDto,
  ListUsersQuery,
} from './user-administration.types'
import {
  ManagedUserEmailAlreadyExistsError,
  ManagedUserRoleChangeHasMembershipsError,
  ManagedUserNotFoundError,
  CannotDisableLastActiveAdminError,
  managedUserNotFoundException,
  cannotChangeAdminRoleException,
  cannotDisableLastActiveAdminException,
  cannotDisableSelfException,
  duplicateManagedUserEmailException,
  managedUserRoleChangeHasMembershipsException,
} from './user-administration.errors'
import {
  UserAdministrationRepository,
  type ListedUserRecord,
  type ManagedUserRecord,
} from './user-administration.repository'

@Injectable()
export class UserAdministrationService {
  constructor(
    private readonly userAdministrationRepository: UserAdministrationRepository,
    private readonly passwordHasherService: PasswordHasher,
    private readonly authUserService: IdentityUser,
  ) {}

  async createUser(
    input: CreateUserRequest,
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<CreateUserResponseDto> {
    const email = this.authUserService.normalizeEmail(input.email)
    const existingUser =
      await this.userAdministrationRepository.findByEmail(email)

    if (existingUser !== null) {
      throw duplicateManagedUserEmailException(email)
    }

    const passwordHash = this.passwordHasherService.createHash(input.password)

    try {
      const user = await this.userAdministrationRepository.createUser({
        email,
        displayName: input.displayName.trim(),
        role: input.role,
        passwordHash,
        actorUserId: actor.id,
        requestContext,
      })

      return {
        user: mapManagedUserRecord(user),
      }
    } catch (error) {
      if (error instanceof ManagedUserEmailAlreadyExistsError) {
        throw duplicateManagedUserEmailException(error.email)
      }

      throw error
    }
  }

  async listUsers(input: ListUsersQuery): Promise<ManagedUserListResponseDto> {
    const page = await this.userAdministrationRepository.listUsers(input)

    return {
      users: page.users.map(mapListedUserRecord),
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    }
  }

  async updateUser(
    userId: string,
    input: UpdateUserRequest,
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<UpdateUserResponseDto> {
    const user = await this.userAdministrationRepository.findById(userId)

    if (user === null) {
      throw managedUserNotFoundException(userId)
    }

    // Admin accounts are never demoted through this endpoint: the create/update
    // role enum excludes ADMIN, so any role change here would silently strip the
    // last administrator of their access.
    if (input.role !== undefined && user.role === UserRole.ADMIN) {
      throw cannotChangeAdminRoleException()
    }

    const email =
      input.email === undefined
        ? undefined
        : this.authUserService.normalizeEmail(input.email)

    if (email !== undefined && email !== user.email) {
      const existingUser =
        await this.userAdministrationRepository.findByEmail(email)

      if (existingUser !== null) {
        throw duplicateManagedUserEmailException(email)
      }
    }

    try {
      const updatedUser = await this.userAdministrationRepository.updateUser({
        userId,
        email,
        displayName: input.displayName?.trim(),
        role: input.role,
        actorUserId: actor.id,
        requestContext,
      })

      return {
        user: mapManagedUserRecord(updatedUser),
      }
    } catch (error) {
      if (error instanceof ManagedUserEmailAlreadyExistsError) {
        throw duplicateManagedUserEmailException(error.email)
      }

      if (error instanceof ManagedUserRoleChangeHasMembershipsError) {
        throw managedUserRoleChangeHasMembershipsException(error.userId)
      }

      throw error
    }
  }

  async disableUser(
    userId: string,
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<DisableUserResponseDto> {
    if (userId === actor.id) {
      throw cannotDisableSelfException()
    }

    const user = await this.userAdministrationRepository.findById(userId)

    if (user === null) {
      throw managedUserNotFoundException(userId)
    }

    if (user.status === UserStatus.DISABLED) {
      return {
        user: mapManagedUserRecord(user),
      }
    }

    let disabledUser: ManagedUserRecord

    try {
      disabledUser = await this.userAdministrationRepository.disableUser({
        userId,
        actorUserId: actor.id,
        disabledAt: new Date(),
        requestContext,
      })
    } catch (error) {
      if (error instanceof CannotDisableLastActiveAdminError) {
        throw cannotDisableLastActiveAdminException()
      }

      if (error instanceof ManagedUserNotFoundError) {
        throw managedUserNotFoundException(error.userId)
      }

      throw error
    }

    return {
      user: mapManagedUserRecord(disabledUser),
    }
  }

  async reactivateUser(
    userId: string,
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<ReactivateUserResponseDto> {
    const user = await this.userAdministrationRepository.findById(userId)

    if (user === null) {
      throw managedUserNotFoundException(userId)
    }

    if (user.status === UserStatus.ACTIVE) {
      return {
        user: mapManagedUserRecord(user),
      }
    }

    const reactivatedUser =
      await this.userAdministrationRepository.reactivateUser({
        userId,
        actorUserId: actor.id,
        requestContext,
      })

    return {
      user: mapManagedUserRecord(reactivatedUser),
    }
  }

  async resetUserPassword(
    userId: string,
    input: ResetUserPasswordRequest,
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<ResetUserPasswordResponseDto> {
    const user = await this.userAdministrationRepository.findById(userId)

    if (user === null) {
      throw managedUserNotFoundException(userId)
    }

    const passwordHash = this.passwordHasherService.createHash(
      input.newPassword,
    )
    const resetUser = await this.userAdministrationRepository.resetUserPassword(
      {
        userId,
        passwordHash,
        passwordChangedAt: new Date(),
        actorUserId: actor.id,
        requestContext,
      },
    )

    return {
      user: mapManagedUserRecord(resetUser),
    }
  }
}

function mapListedUserRecord(user: ListedUserRecord) {
  const courses = user.memberships
    .map((membership) => ({
      courseId: membership.courseId,
      code: membership.course.code,
      title: membership.course.title,
      role: membership.role,
    }))
    .sort(compareCourseAssignments)

  return {
    ...mapManagedUserRecord(user),
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

function mapManagedUserRecord(user: ManagedUserRecord) {
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
