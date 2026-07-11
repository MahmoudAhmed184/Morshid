import { BadRequestException, ConflictException } from '@nestjs/common'

import { UserRole, UserStatus } from '../../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../../auth/auth.dto'
import type { AuthUserService } from '../../auth/services/auth-user.service'
import type { PasswordHasherService } from '../../auth/services/password-hasher.service'
import { ADMIN_USERS_ERROR_CODES } from './admin-users.errors'
import {
  AdminUsersRepository,
  type AdminUserRecord,
  type CreateAdminUserRepositoryInput,
} from './admin-users.repository'
import { AdminUsersService } from './admin-users.service'

const createdAt = new Date('2026-07-11T10:00:00.000Z')
const updatedAt = new Date('2026-07-11T10:01:00.000Z')

class AdminUsersServiceTestRepository extends AdminUsersRepository {
  readonly users = new Map<string, AdminUserRecord>()
  readonly createUser = jest.fn((input: CreateAdminUserRepositoryInput) =>
    Promise.resolve(this.insertUser(input)),
  )

  findByEmail(email: string): Promise<AdminUserRecord | null> {
    return Promise.resolve(this.users.get(email) ?? null)
  }

  listUsers(): Promise<AdminUserRecord[]> {
    return Promise.resolve(
      [...this.users.values()].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      ),
    )
  }

  addUser(user: AdminUserRecord) {
    this.users.set(user.email, user)
  }

  private insertUser(input: CreateAdminUserRepositoryInput): AdminUserRecord {
    const user: AdminUserRecord = {
      id: `created-${this.users.size.toString()}`,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt,
    }

    this.addUser(user)

    return user
  }
}

describe('AdminUsersService', () => {
  const actor: AuthenticatedRequestUser = {
    id: 'admin-user',
    email: 'admin@morshid.demo',
    displayName: 'Demo Admin',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  }
  const requestContext = {
    ip: '203.0.113.10',
    userAgent: 'Jest',
  }

  function buildService() {
    const repository = new AdminUsersServiceTestRepository()
    const createHash = jest.fn((password: string) => `hashed:${password}`)
    const passwordHasherService = {
      createHash,
    } as unknown as PasswordHasherService
    const normalizeEmail = jest.fn((email: string) =>
      email.trim().toLowerCase(),
    )
    const authUserService = {
      normalizeEmail,
    } as unknown as AuthUserService

    return {
      authUserService,
      createHash,
      normalizeEmail,
      passwordHasherService,
      repository,
      service: new AdminUsersService(
        repository,
        passwordHasherService,
        authUserService,
      ),
    }
  }

  it.each([UserRole.STUDENT, UserRole.INSTRUCTOR])(
    'creates a %s user with a hashed password and sanitized response',
    async (role) => {
      const { createHash, repository, service } = buildService()

      const response = await service.createUser(
        {
          email: '  New.User@Morshid.Demo  ',
          displayName: '  New User  ',
          role,
          password: '123',
        },
        actor,
        requestContext,
      )

      expect(createHash).toHaveBeenCalledWith('123')
      expect(repository.createUser.mock.calls).toEqual([
        [
          {
            email: 'new.user@morshid.demo',
            displayName: 'New User',
            role,
            passwordHash: 'hashed:123',
            actorUserId: actor.id,
            requestContext,
          },
        ],
      ])
      expect(response).toEqual({
        user: {
          id: 'created-0',
          email: 'new.user@morshid.demo',
          displayName: 'New User',
          role,
          status: UserStatus.ACTIVE,
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      })
      expect(response.user).not.toHaveProperty('passwordHash')
      expect(response.user).not.toHaveProperty('password')
      expect(response.user).not.toHaveProperty('refreshTokens')
    },
  )

  it('rejects attempts to create an admin user', async () => {
    const { repository, service } = buildService()
    const createUser = service.createUser(
      {
        email: 'new-admin@morshid.demo',
        displayName: 'New Admin',
        role: UserRole.ADMIN,
        password: 'temporary-password',
      },
      actor,
      requestContext,
    )

    await expect(createUser).rejects.toBeInstanceOf(BadRequestException)
    await expect(createUser).rejects.toMatchObject({
      response: {
        code: ADMIN_USERS_ERROR_CODES.UNSUPPORTED_ROLE,
        message: 'Admin users can only create STUDENT or INSTRUCTOR accounts',
      },
    })
    expect(repository.createUser.mock.calls).toHaveLength(0)
  })

  it('rejects duplicate emails before hashing', async () => {
    const { createHash, repository, service } = buildService()

    repository.addUser({
      id: 'existing-user',
      email: 'existing@morshid.demo',
      displayName: 'Existing User',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt,
    })

    const createUser = service.createUser(
      {
        email: 'EXISTING@MORSHID.DEMO',
        displayName: 'Existing User',
        role: UserRole.STUDENT,
        password: 'temporary-password',
      },
      actor,
      requestContext,
    )

    await expect(createUser).rejects.toBeInstanceOf(ConflictException)
    await expect(createUser).rejects.toMatchObject({
      response: {
        code: ADMIN_USERS_ERROR_CODES.DUPLICATE_EMAIL,
        message: 'A user with this email already exists',
        email: 'existing@morshid.demo',
      },
    })
    expect(createHash).not.toHaveBeenCalled()
    expect(repository.createUser.mock.calls).toHaveLength(0)
  })
})
