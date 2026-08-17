import { randomUUID } from 'node:crypto'

import type { ConfigService } from '@nestjs/config'
import { Client } from 'pg'

import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../../src/generated/prisma/client'
import { AUDIT_EVENT_ACTIONS } from '../../src/modules/audit/audit.constants'
import { IdentityUser } from '../../src/modules/identity/identity-user'
import { RefreshSessionRepository } from '../../src/modules/identity/refresh-session.repository'
import { RefreshSession } from '../../src/modules/identity/refresh-session'
import { UserAdministrationAuditService } from '../../src/modules/identity/user-administration/user-administration-audit'
import {
  ManagedUserEmailAlreadyExistsError,
  ManagedUserRoleChangeHasMembershipsError,
  CannotDisableLastActiveAdminError,
} from '../../src/modules/identity/user-administration/user-administration.errors'
import { PrismaUserAdministrationRepository } from '../../src/modules/identity/user-administration/user-administration.repository'
import type { UserAdministrationRepository } from '../../src/modules/identity/user-administration/user-administration.repository'
import { AuditService } from '../../src/modules/audit/audit.service'
import type { AppEnvironment } from '../../src/platform/config/env.schema'
import type { PrismaService } from '../../src/platform/database/prisma.service'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'

describe('Admin users persistence (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let repository: UserAdministrationRepository
  const createdUserIds = new Set<string>()
  const createdCourseIds = new Set<string>()

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_pr61')
    prisma = database.prisma
    const auditService = new AuditService(prisma)
    const userAdministrationAuditService = new UserAdministrationAuditService(
      auditService,
    )
    repository = new PrismaUserAdministrationRepository(
      prisma,
      userAdministrationAuditService,
    )
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

  it('revokes a replacement token created concurrently with a password reset', async () => {
    const actor = await createUser(UserRole.ADMIN)
    const target = await createUser(UserRole.STUDENT)
    const refreshSession = new RefreshSession(
      refreshSessionConfig,
      new RefreshSessionRepository(prisma),
      new IdentityUser(prisma),
    )
    const issuedAt = new Date()
    const created = await refreshSession.create(target, issuedAt, {})
    const resetAt = new Date(issuedAt.getTime() + 1_000)
    if (database === undefined) {
      throw new Error('Expected the disposable database to be initialized')
    }
    const blocker = new Client({ connectionString: database.databaseUrl })

    await blocker.connect()
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION block_refresh_rotation_for_test() RETURNS trigger AS $$
      BEGIN
        IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
          PERFORM pg_advisory_xact_lock(20501);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER block_refresh_rotation_for_test
      AFTER UPDATE OF revoked_at ON refresh_tokens
      FOR EACH ROW EXECUTE FUNCTION block_refresh_rotation_for_test();
    `)
    await blocker.query('BEGIN')
    await blocker.query('SELECT pg_advisory_lock(20501)')

    try {
      const rotation = refreshSession.rotate(created.token, resetAt, {})
      await waitForBlockedQueryCount(prisma, 1)
      const reset = repository.resetUserPassword({
        userId: target.id,
        passwordHash: 'new-test-password-hash',
        passwordChangedAt: resetAt,
        actorUserId: actor.id,
      })
      await waitForBlockedQueryCount(prisma, 2)

      await blocker.query('SELECT pg_advisory_unlock(20501)')
      const [rotationResult] = await Promise.all([rotation, reset])

      expect(rotationResult.kind).toBe('rotated')
      await expect(
        prisma.refreshToken.count({
          where: {
            userId: target.id,
            revokedAt: null,
            expiresAt: { gt: resetAt },
          },
        }),
      ).resolves.toBe(0)
      await expect(
        refreshSession.rotate(
          rotationResult.kind === 'rotated'
            ? rotationResult.nextRefreshToken.token
            : '',
          new Date(resetAt.getTime() + 1),
          {},
        ),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_REFRESH_TOKEN' },
      })
    } finally {
      await blocker.query('ROLLBACK')
      await blocker.end()
      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS block_refresh_rotation_for_test ON refresh_tokens;
        DROP FUNCTION IF EXISTS block_refresh_rotation_for_test();
      `)
    }
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
    } as unknown as UserAdministrationAuditService
    const failingRepository = new PrismaUserAdministrationRepository(
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
    ).rejects.toBeInstanceOf(ManagedUserEmailAlreadyExistsError)
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
    ).rejects.toBeInstanceOf(ManagedUserRoleChangeHasMembershipsError)

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

const refreshSessionConfig = {
  get: (key: keyof AppEnvironment) => {
    if (key === 'AUTH_REFRESH_TOKEN_HASH_SECRET') {
      return 'test-refresh-token-hash-secret-with-at-least-32-characters'
    }
    if (key === 'AUTH_REFRESH_TOKEN_TTL_DAYS') {
      return 7
    }
    throw new Error(`Unexpected refresh-session configuration key: ${key}`)
  },
} as ConfigService<AppEnvironment, true>

async function waitForBlockedQueryCount(
  prisma: PrismaService,
  expectedCount: number,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const blocked = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
    `
    if (Number(blocked[0]?.count ?? 0) >= expectedCount) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  throw new Error(
    `Timed out waiting for ${String(expectedCount)} blocked database queries`,
  )
}
