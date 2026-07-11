import { randomUUID } from 'node:crypto'

import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'

import { AppModule } from '../src/app.module'
import { UserRole, UserStatus } from '../src/generated/prisma/client'
import type { AdminUsersAuditService } from '../src/modules/admin/users/admin-users.audit.service'
import {
  AdminUserEmailAlreadyExistsError,
  CannotDisableLastActiveAdminError,
} from '../src/modules/admin/users/admin-users.errors'
import {
  AdminUsersRepository,
  PrismaAdminUsersRepository,
} from '../src/modules/admin/users/admin-users.repository'
import { PrismaService } from '../src/modules/prisma/prisma.service'

describe('Admin users persistence (e2e)', () => {
  let moduleFixture: TestingModule
  let prisma: PrismaService
  let repository: AdminUsersRepository
  const createdUserIds = new Set<string>()
  const disabledFixtureAdminIds = new Set<string>()

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile()
    await moduleFixture.init()
    prisma = moduleFixture.get(PrismaService)
    repository = moduleFixture.get(AdminUsersRepository)
  })

  afterEach(async () => {
    const ids = [...createdUserIds]

    if (ids.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ actorUserId: { in: ids } }, { targetId: { in: ids } }],
        },
      })
      await prisma.user.deleteMany({ where: { id: { in: ids } } })
      createdUserIds.clear()
    }

    if (disabledFixtureAdminIds.size > 0) {
      await prisma.user.updateMany({
        where: { id: { in: [...disabledFixtureAdminIds] } },
        data: { status: UserStatus.ACTIVE, disabledAt: null, disabledById: null },
      })
      disabledFixtureAdminIds.clear()
    }
  })

  afterAll(async () => {
    await moduleFixture.close()
  })

  it('keeps one admin active when two admins disable each other concurrently', async () => {
    const existingAdmins = await prisma.user.findMany({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      select: { id: true },
    })
    existingAdmins.forEach((admin) => disabledFixtureAdminIds.add(admin.id))
    await prisma.user.updateMany({
      where: { id: { in: [...disabledFixtureAdminIds] } },
      data: { status: UserStatus.DISABLED, disabledAt: new Date() },
    })
    const first = await createUser(UserRole.ADMIN)
    const second = await createUser(UserRole.ADMIN)
    const disabledAt = new Date()
    const results = await Promise.allSettled([
      repository.disableUser({
        userId: first.id,
        actorUserId: second.id,
        disabledAt,
      }),
      repository.disableUser({
        userId: second.id,
        actorUserId: first.id,
        disabledAt,
      }),
    ])
    const storedUsers = await prisma.user.findMany({
      where: { id: { in: [first.id, second.id] } },
      select: { status: true },
    })

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(
      1,
    )
    const rejection = results.find((result) => result.status === 'rejected')
    expect(rejection?.reason).toBeInstanceOf(CannotDisableLastActiveAdminError)
    expect(
      storedUsers.filter((user) => user.status === UserStatus.ACTIVE),
    ).toHaveLength(1)
  })

  it('rolls back the user mutation when audit persistence fails', async () => {
    const actor = await createUser(UserRole.ADMIN)
    const target = await createUser(UserRole.STUDENT)
    const failingAuditService = {
      recordUserCreated: jest.fn(),
      recordUserDisabled: jest.fn().mockRejectedValue(new Error('audit failed')),
      recordUserReactivated: jest.fn(),
      recordUserPasswordReset: jest.fn(),
    } as unknown as AdminUsersAuditService
    const failingRepository = new PrismaAdminUsersRepository(
      prisma,
      failingAuditService,
    )

    await expect(
      failingRepository.disableUser({
        userId: target.id,
        actorUserId: actor.id,
        disabledAt: new Date(),
      }),
    ).rejects.toThrow('audit failed')
    await expect(
      prisma.user.findUniqueOrThrow({
        where: { id: target.id },
        select: { status: true, disabledAt: true, disabledById: true },
      }),
    ).resolves.toEqual({
      status: UserStatus.ACTIVE,
      disabledAt: null,
      disabledById: null,
    })
  })

  it('maps the PostgreSQL email constraint to the repository domain error', async () => {
    const actor = await createUser(UserRole.ADMIN)
    const existing = await createUser(UserRole.STUDENT)

    await expect(
      repository.createUser({
        email: existing.email,
        displayName: 'Duplicate user',
        role: UserRole.STUDENT,
        passwordHash: 'test-password-hash',
        actorUserId: actor.id,
      }),
    ).rejects.toBeInstanceOf(AdminUserEmailAlreadyExistsError)
  })

  it('exposes native UUID errors below the validated HTTP boundary', async () => {
    await expect(repository.findById('not-a-uuid')).rejects.toThrow()
  })

  async function createUser(role: UserRole) {
    const user = await prisma.user.create({
      data: {
        email: `pr61-${randomUUID()}@morshid.test`,
        displayName: `PR 61 ${role}`,
        role,
        passwordHash: 'test-password-hash',
      },
    })
    createdUserIds.add(user.id)
    return user
  }
})
