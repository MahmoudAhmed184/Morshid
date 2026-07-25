import { randomUUID } from 'node:crypto'

import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../src/generated/prisma/client'
import { AUDIT_EVENT_ACTIONS } from '../src/modules/audit/audit.constants'
import { AdminUsersAuditService } from '../src/modules/admin/users/admin-users.audit.service'
import {
  AdminUserEmailAlreadyExistsError,
  AdminUserRoleChangeHasMembershipsError,
  CannotDisableLastActiveAdminError,
} from '../src/modules/admin/users/admin-users.errors'
import { PrismaAdminUsersRepository } from '../src/modules/admin/users/admin-users.repository'
import type { AdminUsersRepository } from '../src/modules/admin/users/admin-users.repository'
import { AuditService } from '../src/modules/audit/audit.service'
import type { PrismaService } from '../src/modules/prisma/prisma.service'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

describe('Admin users persistence (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let repository: AdminUsersRepository
  const createdUserIds = new Set<string>()
  const createdCourseIds = new Set<string>()

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_pr61')
    prisma = database.prisma
    const auditService = new AuditService(prisma)
    const adminUsersAuditService = new AdminUsersAuditService(auditService)
    repository = new PrismaAdminUsersRepository(prisma, adminUsersAuditService)
    const [connection] = await prisma.$queryRaw<{ database: string }[]>`
      SELECT current_database() AS database
    `
    expect(connection.database).toBe(database.databaseName)
  })

  afterEach(async () => {
    const ids = [...createdUserIds]
    const courseIds = [...createdCourseIds]

    if (courseIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { courseId: { in: courseIds } },
      })
      await prisma.courseMembership.deleteMany({
        where: { courseId: { in: courseIds } },
      })
      await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
      createdCourseIds.clear()
    }

    if (ids.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ actorUserId: { in: ids } }, { targetId: { in: ids } }],
        },
      })
      await prisma.user.deleteMany({ where: { id: { in: ids } } })
      createdUserIds.clear()
    }
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('keeps one admin active when two admins disable each other concurrently', async () => {
    const first = await createUser(UserRole.ADMIN)
    const second = await createUser(UserRole.ADMIN)
    await expect(
      prisma.user.count({
        where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      }),
    ).resolves.toBe(2)
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

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
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
      recordUserDisabled: jest
        .fn()
        .mockRejectedValue(new Error('audit failed')),
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

  it('refuses a role change while an active course membership exists and leaves no audit trail', async () => {
    const actor = await createUser(UserRole.ADMIN)
    const target = await createUser(UserRole.STUDENT)
    const course = await createCourse(actor.id)
    await prisma.courseMembership.create({
      data: {
        courseId: course.id,
        userId: target.id,
        role: CourseMembershipRole.STUDENT,
        createdById: actor.id,
      },
    })

    await expect(
      repository.updateUser({
        userId: target.id,
        role: UserRole.INSTRUCTOR,
        actorUserId: actor.id,
      }),
    ).rejects.toBeInstanceOf(AdminUserRoleChangeHasMembershipsError)

    await expect(
      prisma.user.findUniqueOrThrow({
        where: { id: target.id },
        select: { role: true },
      }),
    ).resolves.toEqual({ role: UserRole.STUDENT })
    await expect(
      prisma.auditLog.count({
        where: {
          targetId: target.id,
          action: AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_UPDATED,
        },
      }),
    ).resolves.toBe(0)
  })

  it('applies a role change and records before/after audit metadata once memberships are removed', async () => {
    const actor = await createUser(UserRole.ADMIN)
    const target = await createUser(UserRole.STUDENT)
    const course = await createCourse(actor.id)
    await prisma.courseMembership.create({
      data: {
        courseId: course.id,
        userId: target.id,
        role: CourseMembershipRole.STUDENT,
        createdById: actor.id,
        removedAt: new Date(),
      },
    })

    const updated = await repository.updateUser({
      userId: target.id,
      role: UserRole.INSTRUCTOR,
      displayName: 'Promoted Instructor',
      actorUserId: actor.id,
    })

    expect(updated).toMatchObject({
      id: target.id,
      role: UserRole.INSTRUCTOR,
      displayName: 'Promoted Instructor',
    })

    const auditEvents = await prisma.auditLog.findMany({
      where: {
        targetId: target.id,
        action: AUDIT_EVENT_ACTIONS.ADMIN_ACCOUNT_UPDATED,
      },
      select: { actorUserId: true, metadata: true },
    })

    expect(auditEvents).toEqual([
      {
        actorUserId: actor.id,
        metadata: {
          before: {
            email: target.email,
            displayName: target.displayName,
            role: UserRole.STUDENT,
          },
          after: {
            email: target.email,
            displayName: 'Promoted Instructor',
            role: UserRole.INSTRUCTOR,
          },
          changedFields: ['displayName', 'role'],
        },
      },
    ])
  })

  async function createCourse(createdById: string) {
    const course = await prisma.course.create({
      data: {
        code: `PR61-${randomUUID().slice(0, 8)}`,
        title: 'PR 61 persistence course',
        createdById,
      },
    })
    createdCourseIds.add(course.id)
    return course
  }

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
