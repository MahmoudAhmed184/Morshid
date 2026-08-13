import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'

import { CourseMembershipRole } from '../../courses/interface/course-membership-role'
import type { AuthenticatedUser } from '../../identity/identity.types'
import type { IdentityUser } from '../../identity/identity-user'
import { UserRole, UserStatus } from '../../identity/identity.roles'
import type { PasswordHasher } from '../../identity/password-hasher'
import {
  USER_ADMINISTRATION_ERROR_CODES,
  ManagedUserRoleChangeHasMembershipsError,
  CannotDisableLastActiveAdminError,
} from './user-administration.errors'
import {
  UserAdministrationRepository,
  type ListedUsersPage,
  type ListedUserRecord,
  type ManagedUserRecord,
  type CreateManagedUserRepositoryInput,
  type DisableManagedUserRepositoryInput,
  type ListUserAdministrationRepositoryInput,
  type ReactivateManagedUserRepositoryInput,
  type ResetManagedUserPasswordRepositoryInput,
  type UpdateManagedUserRepositoryInput,
} from './user-administration.repository'
import { UserAdministrationService } from './user-administration.service'

const createdAt = new Date('2026-07-11T10:00:00.000Z')
const updatedAt = new Date('2026-07-11T10:01:00.000Z')

class UserAdministrationServiceTestRepository extends UserAdministrationRepository {
  readonly users = new Map<string, ListedUserRecord>()
  readonly createUser = jest.fn((input: CreateManagedUserRepositoryInput) =>
    Promise.resolve(this.insertUser(input)),
  )
  readonly updateUser = jest.fn((input: UpdateManagedUserRepositoryInput) =>
    Promise.resolve(this.updateExistingUser(input)),
  )
  readonly disableUser = jest.fn((input: DisableManagedUserRepositoryInput) =>
    Promise.resolve(this.disableExistingUser(input)),
  )
  readonly reactivateUser = jest.fn(
    (input: ReactivateManagedUserRepositoryInput) =>
      Promise.resolve(this.reactivateExistingUser(input)),
  )
  readonly resetUserPassword = jest.fn(
    (input: ResetManagedUserPasswordRepositoryInput) =>
      Promise.resolve(this.resetExistingUserPassword(input)),
  )

  findByEmail(email: string): Promise<ManagedUserRecord | null> {
    return Promise.resolve(this.users.get(email) ?? null)
  }

  findByEmails(emails: string[]): Promise<ManagedUserRecord[]> {
    return Promise.resolve(
      emails.flatMap((email) => {
        const user = this.users.get(email)
        return user ? [user] : []
      }),
    )
  }

  findById(userId: string): Promise<ManagedUserRecord | null> {
    return Promise.resolve(
      [...this.users.values()].find((user) => user.id === userId) ?? null,
    )
  }

  listUsers(
    input: ListUserAdministrationRepositoryInput,
  ): Promise<ListedUsersPage> {
    const users = [...this.users.values()].sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id),
    )
    const cursorIndex =
      input.cursor === undefined
        ? -1
        : users.findIndex((user) => user.id === input.cursor)
    const pageStart = cursorIndex + 1
    const candidates = users.slice(pageStart, pageStart + input.limit + 1)
    const hasNextPage = candidates.length > input.limit
    const pageUsers = hasNextPage
      ? candidates.slice(0, input.limit)
      : candidates
    const nextCursor = hasNextPage ? pageUsers.at(-1)?.id : undefined

    return Promise.resolve({
      users: pageUsers,
      ...(nextCursor === undefined ? {} : { nextCursor }),
    })
  }

  createUsers(
    inputs: CreateManagedUserRepositoryInput[],
  ): Promise<ManagedUserRecord[]> {
    return Promise.resolve(inputs.map((input) => this.insertUser(input)))
  }

  addUser(
    user: ManagedUserRecord & Pick<Partial<ListedUserRecord>, 'memberships'>,
  ) {
    this.users.set(user.email, {
      ...user,
      memberships: user.memberships ?? [],
    })
  }

  private insertUser(
    input: CreateManagedUserRepositoryInput,
  ): ListedUserRecord {
    const user: ListedUserRecord = {
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

  private updateExistingUser(
    input: UpdateManagedUserRepositoryInput,
  ): ListedUserRecord {
    const user = [...this.users.values()].find(
      (storedUser) => storedUser.id === input.userId,
    )

    if (!user) {
      throw new Error(`Missing user ${input.userId}`)
    }

    const updatedUser = {
      ...user,
      email: input.email ?? user.email,
      displayName: input.displayName ?? user.displayName,
      role: input.role ?? user.role,
      updatedAt,
    }

    this.users.delete(user.email)
    this.users.set(updatedUser.email, updatedUser)

    return updatedUser
  }

  private disableExistingUser(
    input: DisableManagedUserRepositoryInput,
  ): ListedUserRecord {
    const user = [...this.users.values()].find(
      (storedUser) => storedUser.id === input.userId,
    )

    if (!user) {
      throw new Error(`Missing user ${input.userId}`)
    }

    if (user.role === UserRole.ADMIN) {
      const activeAdminCount = [...this.users.values()].filter(
        (storedUser) =>
          storedUser.role === UserRole.ADMIN &&
          storedUser.status === UserStatus.ACTIVE,
      ).length

      if (activeAdminCount <= 1) {
        throw new CannotDisableLastActiveAdminError()
      }
    }

    const disabledUser = {
      ...user,
      status: UserStatus.DISABLED,
      updatedAt,
    }

    this.users.set(disabledUser.email, disabledUser)

    return disabledUser
  }

  private reactivateExistingUser(
    input: ReactivateManagedUserRepositoryInput,
  ): ListedUserRecord {
    const user = [...this.users.values()].find(
      (storedUser) => storedUser.id === input.userId,
    )

    if (!user) {
      throw new Error(`Missing user ${input.userId}`)
    }

    const reactivatedUser = {
      ...user,
      status: UserStatus.ACTIVE,
      updatedAt,
    }

    this.users.set(reactivatedUser.email, reactivatedUser)

    return reactivatedUser
  }

  private resetExistingUserPassword(
    input: ResetManagedUserPasswordRepositoryInput,
  ): ListedUserRecord {
    const user = [...this.users.values()].find(
      (storedUser) => storedUser.id === input.userId,
    )

    if (!user) {
      throw new Error(`Missing user ${input.userId}`)
    }

    const resetUser = {
      ...user,
      updatedAt,
    }

    this.users.set(resetUser.email, resetUser)

    return resetUser
  }
}

describe('UserAdministrationService', () => {
  const actor: AuthenticatedUser = {
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
    const repository = new UserAdministrationServiceTestRepository()
    const createHash = jest.fn((password: string) => `hashed:${password}`)
    const passwordHasherService = {
      createHash,
    } as unknown as PasswordHasher
    const normalizeEmail = jest.fn((email: string) =>
      email.trim().toLowerCase(),
    )
    const authUserService = {
      normalizeEmail,
    } as unknown as IdentityUser

    return {
      authUserService,
      createHash,
      normalizeEmail,
      passwordHasherService,
      repository,
      service: new UserAdministrationService(
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

  it('bulk creates normalized users with hashed passwords', async () => {
    const { createHash, repository, service } = buildService()

    const response = await service.bulkCreateUsers(
      {
        users: [
          {
            email: ' First@Morshid.Demo ',
            displayName: ' First Student ',
            role: UserRole.STUDENT,
            password: 'FirstPassword1!',
          },
          {
            email: 'Doctor@Morshid.Demo',
            displayName: ' Demo Doctor ',
            role: UserRole.INSTRUCTOR,
            password: 'SecondPassword2!',
          },
        ],
      },
      actor,
      requestContext,
    )

    expect(createHash.mock.calls).toEqual([
      ['FirstPassword1!'],
      ['SecondPassword2!'],
    ])
    expect([...repository.users.keys()]).toEqual([
      'first@morshid.demo',
      'doctor@morshid.demo',
    ])
    expect(response.users).toHaveLength(2)
    expect(response.users[1]).toMatchObject({
      displayName: 'Demo Doctor',
      role: UserRole.INSTRUCTOR,
    })
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
        code: USER_ADMINISTRATION_ERROR_CODES.DUPLICATE_EMAIL,
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

    const response = await service.listUsers({ limit: 50 })

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

  it('updates a user profile through the repository and returns a safe response', async () => {
    const { normalizeEmail, repository, service } = buildService()

    repository.addUser({
      id: 'target-user',
      email: 'target@morshid.demo',
      displayName: 'Target User',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt,
    })

    const response = await service.updateUser(
      'target-user',
      {
        email: '  Renamed@Morshid.Demo  ',
        displayName: '  Renamed User  ',
        role: UserRole.INSTRUCTOR,
      },
      actor,
      requestContext,
    )

    expect(normalizeEmail).toHaveBeenCalledWith('  Renamed@Morshid.Demo  ')
    expect(repository.updateUser.mock.calls).toEqual([
      [
        {
          userId: 'target-user',
          email: 'renamed@morshid.demo',
          displayName: 'Renamed User',
          role: UserRole.INSTRUCTOR,
          actorUserId: actor.id,
          requestContext,
        },
      ],
    ])
    expect(response).toEqual({
      user: {
        id: 'target-user',
        email: 'renamed@morshid.demo',
        displayName: 'Renamed User',
        role: UserRole.INSTRUCTOR,
        status: UserStatus.ACTIVE,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    })
    expect(response.user).not.toHaveProperty('passwordHash')
    expect(response.user).not.toHaveProperty('refreshTokens')
  })

  it('rejects updating a missing user', async () => {
    const { repository, service } = buildService()

    const updateUser = service.updateUser(
      'missing-user',
      { displayName: 'Renamed User' },
      actor,
      requestContext,
    )

    await expect(updateUser).rejects.toBeInstanceOf(NotFoundException)
    await expect(updateUser).rejects.toMatchObject({
      response: {
        code: USER_ADMINISTRATION_ERROR_CODES.USER_NOT_FOUND,
        message: 'User target was not found',
        userId: 'missing-user',
      },
    })
    expect(repository.updateUser.mock.calls).toHaveLength(0)
  })

  it('rejects updating a user to an email owned by another account', async () => {
    const { repository, service } = buildService()

    repository.addUser({
      id: 'target-user',
      email: 'target@morshid.demo',
      displayName: 'Target User',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt,
    })
    repository.addUser({
      id: 'other-user',
      email: 'other@morshid.demo',
      displayName: 'Other User',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt,
    })

    const updateUser = service.updateUser(
      'target-user',
      { email: 'OTHER@MORSHID.DEMO' },
      actor,
      requestContext,
    )

    await expect(updateUser).rejects.toBeInstanceOf(ConflictException)
    await expect(updateUser).rejects.toMatchObject({
      response: {
        code: USER_ADMINISTRATION_ERROR_CODES.DUPLICATE_EMAIL,
        email: 'other@morshid.demo',
      },
    })
    expect(repository.updateUser.mock.calls).toHaveLength(0)
  })

  it('allows updating a user without changing their own email', async () => {
    const { repository, service } = buildService()

    repository.addUser({
      id: 'target-user',
      email: 'target@morshid.demo',
      displayName: 'Target User',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt,
    })

    const response = await service.updateUser(
      'target-user',
      { email: 'target@morshid.demo', displayName: 'Renamed User' },
      actor,
      requestContext,
    )

    expect(response.user.email).toBe('target@morshid.demo')
    expect(response.user.displayName).toBe('Renamed User')
  })

  it('rejects changing the role of an admin account', async () => {
    const { repository, service } = buildService()

    repository.addUser({
      id: 'other-admin',
      email: 'other-admin@morshid.demo',
      displayName: 'Other Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt,
    })

    const updateUser = service.updateUser(
      'other-admin',
      { role: UserRole.STUDENT },
      actor,
      requestContext,
    )

    await expect(updateUser).rejects.toBeInstanceOf(ForbiddenException)
    await expect(updateUser).rejects.toMatchObject({
      response: {
        code: USER_ADMINISTRATION_ERROR_CODES.CANNOT_CHANGE_ADMIN_ROLE,
        message: 'Administrator account roles cannot be changed',
      },
    })
    expect(repository.updateUser.mock.calls).toHaveLength(0)
  })

  it('maps a repository role-change membership conflict to a stable 409 response', async () => {
    const { repository, service } = buildService()

    repository.addUser({
      id: 'target-user',
      email: 'target@morshid.demo',
      displayName: 'Target User',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt,
    })
    repository.updateUser.mockImplementationOnce(() =>
      Promise.reject(
        new ManagedUserRoleChangeHasMembershipsError('target-user'),
      ),
    )

    const updateUser = service.updateUser(
      'target-user',
      { role: UserRole.INSTRUCTOR },
      actor,
      requestContext,
    )

    await expect(updateUser).rejects.toBeInstanceOf(ConflictException)
    await expect(updateUser).rejects.toMatchObject({
      response: {
        code: USER_ADMINISTRATION_ERROR_CODES.ROLE_CHANGE_HAS_MEMBERSHIPS,
        message:
          'Remove active course memberships before changing the account role',
        userId: 'target-user',
      },
    })
  })

  it('disables an active user through the repository and returns a safe response', async () => {
    const { repository, service } = buildService()

    repository.addUser({
      id: 'target-user',
      email: 'target@morshid.demo',
      displayName: 'Target User',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt,
    })

    const response = await service.disableUser(
      'target-user',
      actor,
      requestContext,
    )

    expect(repository.disableUser.mock.calls).toHaveLength(1)
    const disableInput = repository.disableUser.mock.calls[0][0]

    expect(disableInput).toMatchObject({
      userId: 'target-user',
      actorUserId: actor.id,
      requestContext,
    })
    expect(disableInput.disabledAt).toBeInstanceOf(Date)
    expect(response).toEqual({
      user: {
        id: 'target-user',
        email: 'target@morshid.demo',
        displayName: 'Target User',
        role: UserRole.STUDENT,
        status: UserStatus.DISABLED,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    })
    expect(response.user).not.toHaveProperty('passwordHash')
    expect(response.user).not.toHaveProperty('refreshTokens')
    expect(response.user).not.toHaveProperty('disabledById')
  })

  it('returns an already disabled user idempotently without another repository disable', async () => {
    const { repository, service } = buildService()

    repository.addUser({
      id: 'disabled-user',
      email: 'disabled@morshid.demo',
      displayName: 'Disabled User',
      role: UserRole.STUDENT,
      status: UserStatus.DISABLED,
      createdAt,
      updatedAt,
    })

    const response = await service.disableUser(
      'disabled-user',
      actor,
      requestContext,
    )

    expect(repository.disableUser.mock.calls).toHaveLength(0)
    expect(response.user).toEqual({
      id: 'disabled-user',
      email: 'disabled@morshid.demo',
      displayName: 'Disabled User',
      role: UserRole.STUDENT,
      status: UserStatus.DISABLED,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    })
  })

  it('reactivates a disabled user through the repository and returns a safe response', async () => {
    const { repository, service } = buildService()

    repository.addUser({
      id: 'disabled-user',
      email: 'disabled@morshid.demo',
      displayName: 'Disabled User',
      role: UserRole.STUDENT,
      status: UserStatus.DISABLED,
      createdAt,
      updatedAt,
    })

    const response = await service.reactivateUser(
      'disabled-user',
      actor,
      requestContext,
    )

    expect(repository.reactivateUser.mock.calls).toEqual([
      [
        {
          userId: 'disabled-user',
          actorUserId: actor.id,
          requestContext,
        },
      ],
    ])
    expect(response).toEqual({
      user: {
        id: 'disabled-user',
        email: 'disabled@morshid.demo',
        displayName: 'Disabled User',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    })
    expect(response.user).not.toHaveProperty('passwordHash')
    expect(response.user).not.toHaveProperty('refreshTokens')
    expect(response.user).not.toHaveProperty('disabledAt')
    expect(response.user).not.toHaveProperty('disabledById')
  })

  it('returns an already active user idempotently without another repository reactivate', async () => {
    const { repository, service } = buildService()

    repository.addUser({
      id: 'active-user',
      email: 'active@morshid.demo',
      displayName: 'Active User',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt,
    })

    const response = await service.reactivateUser(
      'active-user',
      actor,
      requestContext,
    )

    expect(repository.reactivateUser.mock.calls).toHaveLength(0)
    expect(response.user).toEqual({
      id: 'active-user',
      email: 'active@morshid.demo',
      displayName: 'Active User',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    })
  })

  it('resets a user password through the repository and returns a safe response', async () => {
    const { createHash, repository, service } = buildService()

    repository.addUser({
      id: 'target-user',
      email: 'target@morshid.demo',
      displayName: 'Target User',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt,
    })

    const response = await service.resetUserPassword(
      'target-user',
      { newPassword: 'StrongPassword123!' },
      actor,
      requestContext,
    )

    expect(createHash).toHaveBeenCalledWith('StrongPassword123!')
    expect(repository.resetUserPassword.mock.calls).toHaveLength(1)
    const resetInput = repository.resetUserPassword.mock.calls[0][0]

    expect(resetInput).toMatchObject({
      userId: 'target-user',
      passwordHash: 'hashed:StrongPassword123!',
      actorUserId: actor.id,
      requestContext,
    })
    expect(resetInput.passwordChangedAt).toBeInstanceOf(Date)
    expect(response).toEqual({
      user: {
        id: 'target-user',
        email: 'target@morshid.demo',
        displayName: 'Target User',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    })
    expect(response.user).not.toHaveProperty('password')
    expect(response.user).not.toHaveProperty('passwordHash')
    expect(response.user).not.toHaveProperty('refreshTokens')
    expect(response.user).not.toHaveProperty('disabledAt')
    expect(response.user).not.toHaveProperty('disabledById')
  })

  it('resets a disabled user password without reactivating the user', async () => {
    const { repository, service } = buildService()

    repository.addUser({
      id: 'disabled-user',
      email: 'disabled@morshid.demo',
      displayName: 'Disabled User',
      role: UserRole.STUDENT,
      status: UserStatus.DISABLED,
      createdAt,
      updatedAt,
    })

    const response = await service.resetUserPassword(
      'disabled-user',
      { newPassword: 'StrongPassword123!' },
      actor,
      requestContext,
    )

    expect(response.user).toEqual({
      id: 'disabled-user',
      email: 'disabled@morshid.demo',
      displayName: 'Disabled User',
      role: UserRole.STUDENT,
      status: UserStatus.DISABLED,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    })
  })

  it('rejects reactivating a missing user', async () => {
    const { repository, service } = buildService()

    const reactivateUser = service.reactivateUser(
      'missing-user',
      actor,
      requestContext,
    )

    await expect(reactivateUser).rejects.toBeInstanceOf(NotFoundException)
    await expect(reactivateUser).rejects.toMatchObject({
      response: {
        code: USER_ADMINISTRATION_ERROR_CODES.USER_NOT_FOUND,
        message: 'User target was not found',
        userId: 'missing-user',
      },
    })
    expect(repository.reactivateUser.mock.calls).toHaveLength(0)
  })

  it('rejects disabling a missing user', async () => {
    const { service } = buildService()

    const disableUser = service.disableUser(
      'missing-user',
      actor,
      requestContext,
    )

    await expect(disableUser).rejects.toBeInstanceOf(NotFoundException)
    await expect(disableUser).rejects.toMatchObject({
      response: {
        code: USER_ADMINISTRATION_ERROR_CODES.USER_NOT_FOUND,
        message: 'User target was not found',
        userId: 'missing-user',
      },
    })
  })

  it('rejects self-disable attempts', async () => {
    const { repository, service } = buildService()

    const disableUser = service.disableUser(actor.id, actor, requestContext)

    await expect(disableUser).rejects.toBeInstanceOf(ForbiddenException)
    await expect(disableUser).rejects.toMatchObject({
      response: {
        code: USER_ADMINISTRATION_ERROR_CODES.CANNOT_DISABLE_SELF,
        message: 'Administrators cannot disable their own account',
      },
    })
    expect(repository.disableUser.mock.calls).toHaveLength(0)
  })

  it('rejects resetting a missing user before hashing', async () => {
    const { createHash, repository, service } = buildService()

    const resetUserPassword = service.resetUserPassword(
      'missing-user',
      { newPassword: 'StrongPassword123!' },
      actor,
      requestContext,
    )

    await expect(resetUserPassword).rejects.toBeInstanceOf(NotFoundException)
    await expect(resetUserPassword).rejects.toMatchObject({
      response: {
        code: USER_ADMINISTRATION_ERROR_CODES.USER_NOT_FOUND,
        message: 'User target was not found',
        userId: 'missing-user',
      },
    })
    expect(createHash).not.toHaveBeenCalled()
    expect(repository.resetUserPassword.mock.calls).toHaveLength(0)
  })

  it('rejects disabling the last active admin account', async () => {
    const { repository, service } = buildService()

    repository.addUser({
      id: 'last-admin',
      email: 'last-admin@morshid.demo',
      displayName: 'Last Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      createdAt,
      updatedAt,
    })

    const disableUser = service.disableUser('last-admin', actor, requestContext)

    await expect(disableUser).rejects.toBeInstanceOf(ConflictException)
    await expect(disableUser).rejects.toMatchObject({
      response: {
        code: USER_ADMINISTRATION_ERROR_CODES.CANNOT_DISABLE_LAST_ACTIVE_ADMIN,
        message: 'Cannot disable the last active admin account',
      },
    })
  })
})
