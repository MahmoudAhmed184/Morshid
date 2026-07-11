import { Injectable } from '@nestjs/common'

import { UserRole } from '../../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../../auth/auth.dto'
import { AuthUserService } from '../../auth/services/auth-user.service'
import { PasswordHasherService } from '../../auth/services/password-hasher.service'
import type { AuditRequestContext } from '../../audit/audit.service'
import type {
  AdminCreateUserRequest,
  AdminCreateUserResponseDto,
  AdminUserListResponseDto,
} from './admin-users.dto'
import {
  AdminUserEmailAlreadyExistsError,
  duplicateAdminUserEmailException,
  unsupportedAdminCreateUserRoleException,
} from './admin-users.errors'
import {
  AdminUsersRepository,
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
      users: users.map(mapAdminUserRecord),
    }
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
