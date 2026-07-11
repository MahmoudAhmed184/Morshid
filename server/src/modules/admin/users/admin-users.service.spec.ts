import { BadRequestException, ConflictException } from '@nestjs/common'

import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../../auth/auth.dto'
import type { AuthUserService } from '../../auth/services/auth-user.service'
import type { PasswordHasherService } from '../../auth/services/password-hasher.service'
import { ADMIN_USERS_ERROR_CODES } from './admin-users.errors'
import {
  AdminUsersRepository,
  type AdminListedUserRecord,
  type AdminUserRecord,
  type CreateAdminUserRepositoryInput,
  type DisableAdminUserRepositoryInput,
} from './admin-users.repository'
import { AdminUsersService } from './admin-users.service'

const createdAt = new Date('2026-07-11T10:00:00.000Z')
const updatedAt = new Date('2026-07-11T10:01:00.000Z')

class AdminUsersServiceTestRepository extends AdminUsersRepository {
  readonly users = new Map<string, AdminListedUserRecord>()
  readonly createUser = jest.fn((input: CreateAdminUserRepositoryInput) =>
    Promise.resolve(this.insertUser(input)),
  )
  readonly disableUser = jest.fn((input: DisableAdminUserRepositoryInput) =>
    Promise.resolve(this.disableExistingUser(input)),
  )

  findByEmail(email: string): Promise<AdminUserRecord | null> {
    return Promise.resolve(this.users.get(email) ?? null)
  }

  findById(userId: string): Promise<AdminUserRecord | null> {
    return Promise.resolve(
      [...this.users.values()].find((user) => user.id === userId) ?? null,
    )
  }

  listUsers(): Promise<AdminListedUserRecord[]> {
    return Promise.resolve(
      [...this.users.values()].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      ),
    )
  }

  countActiveAdmins(): Promise<number> {
    return Promise.resolve(
      [...this.users.values()].filter(
        (user) =>
          user.role === UserRole.ADMIN && user.status === UserStatus.ACTIVE,
      ).length,
    )
  }

  addUser(
    user: AdminUserRecord & Pick<Partial<AdminListedUserRecord>, 'memberships'>,
  ) {
    this.users.set(user.email, {
      ...user,
      memberships: user.memberships ?? [],
    })
  }

  private insertUser(
    input: CreateAdminUserRepositoryInput,
  ): AdminListedUserRecord {
    const user: AdminListedUserRecord = {
      id: `created-${this.users.size.toString()}`,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt,
      memberships: [],
    }

    this.addUser(user)

    return user
  }

  private disableExistingUser(
    input: DisableAdminUserRepositoryInput,
  ): AdminListedUserRecord {
    const user = [...this.users.values()].find(
      (storedUser) => storedUser.id === input.userId,
    )

    if (!user) {
      throw new Error(`Missing user ${input.userId}`)
    }

    const disabledUser = {
      ...user,
      status: UserStatus.DISABLED,
      updatedAt,
    }

    this.users.set(disabledUser.email, disabledUser)

    return disabledUser
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

  it('lists users as safe public records in repository order', async () => {
    const { repository, service } = buildService()
    const newerCreatedAt = new Date('2026-07-11T11:00:00.000Z')

    repository.addUser({
      id: 'older-user',
      email: 'older@morshid.demo',
      displayName: 'Older User',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt,
      memberships: [
        {
          courseId: 'database-course',
          role: CourseMembershipRole.STUDENT,
          course: {
            id: 'database-course',
            code: 'DB-P0',
            title: 'Database Systems',
          },
        },
      ],
    })
    repository.addUser({
      id: 'newer-user',
      email: 'newer@morshid.demo',
      displayName: 'Newer User',
      role: UserRole.INSTRUCTOR,
      status: UserStatus.ACTIVE,
      createdAt: newerCreatedAt,
      updatedAt: newerCreatedAt,
      memberships: [
        {
          courseId: 'python-course',
          role: CourseMembershipRole.INSTRUCTOR,
          course: {
            id: 'python-course',
            code: 'PYTHON-PROG-P0',
            title: 'Python Programming',
          },
        },
        {
          courseId: 'database-course',
          role: CourseMembershipRole.INSTRUCTOR,
          course: {
            id: 'database-course',
            code: 'DB-P0',
            title: 'Database Systems',
          },
        },
      ],
    })

    const response = await service.listUsers()

    expect(response).toEqual({
      users: [
        {
          id: 'newer-user',
          email: 'newer@morshid.demo',
          displayName: 'Newer User',
          role: UserRole.INSTRUCTOR,
          status: UserStatus.ACTIVE,
          createdAt: newerCreatedAt.toISOString(),
          updatedAt: newerCreatedAt.toISOString(),
          courseAssignments: {
            courseCount: 2,
            instructorCourseCount: 2,
            studentCourseCount: 0,
            courses: [
              {
                courseId: 'database-course',
                code: 'DB-P0',
                title: 'Database Systems',
                role: CourseMembershipRole.INSTRUCTOR,
              },
              {
                courseId: 'python-course',
                code: 'PYTHON-PROG-P0',
                title: 'Python Programming',
                role: CourseMembershipRole.INSTRUCTOR,
              },
            ],
          },
        },
        {
          id: 'older-user',
          email: 'older@morshid.demo',
          displayName: 'Older User',
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
          courseAssignments: {
            courseCount: 1,
            instructorCourseCount: 0,
            studentCourseCount: 1,
            courses: [
              {
                courseId: 'database-course',
                code: 'DB-P0',
                title: 'Database Systems',
                role: CourseMembershipRole.STUDENT,
              },
            ],
          },
        },
      ],
    })
    expect(response.users[0]).not.toHaveProperty('passwordHash')
    expect(response.users[0]).not.toHaveProperty('refreshTokens')
  })
})
