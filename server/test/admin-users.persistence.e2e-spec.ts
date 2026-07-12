import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import type { ConfigService } from '@nestjs/config'
import { Client } from 'pg'

import { UserRole, UserStatus } from '../src/generated/prisma/client'
import { AdminUsersAuditService } from '../src/modules/admin/users/admin-users.audit.service'
import {
  AdminUserEmailAlreadyExistsError,
  CannotDisableLastActiveAdminError,
} from '../src/modules/admin/users/admin-users.errors'
import { PrismaAdminUsersRepository } from '../src/modules/admin/users/admin-users.repository'
import type { AdminUsersRepository } from '../src/modules/admin/users/admin-users.repository'
import { AuditService } from '../src/modules/audit/audit.service'
import type { AppEnvironment } from '../src/modules/config/env.schema'
import { PrismaService } from '../src/modules/prisma/prisma.service'

describe('Admin users persistence (e2e)', () => {
  let prisma: PrismaService
  let repository: AdminUsersRepository
  let originalDatabaseUrl: string
  let disposableDatabaseName: string
  const createdUserIds = new Set<string>()

  beforeAll(async () => {
    originalDatabaseUrl = requireDatabaseUrl()
    disposableDatabaseName = `morshid_pr61_${randomUUID().replaceAll('-', '')}`
    await runDatabaseAdminStatement(
      originalDatabaseUrl,
      `CREATE DATABASE "${disposableDatabaseName}"`,
    )
    const disposableDatabaseUrl = databaseUrlFor(
      originalDatabaseUrl,
      disposableDatabaseName,
    )
    await applyMigrations(disposableDatabaseUrl)
    const configService = {
      get: () => disposableDatabaseUrl,
    } as unknown as ConfigService<AppEnvironment, true>
    prisma = new PrismaService(configService)
    await prisma.$connect()
    const auditService = new AuditService(prisma)
    const adminUsersAuditService = new AdminUsersAuditService(auditService)
    repository = new PrismaAdminUsersRepository(prisma, adminUsersAuditService)
    const [connection] = await prisma.$queryRaw<{ database: string }[]>`
      SELECT current_database() AS database
    `
    expect(connection.database).toBe(disposableDatabaseName)
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
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await runDatabaseAdminStatement(
      originalDatabaseUrl,
      `DROP DATABASE IF EXISTS "${disposableDatabaseName}" WITH (FORCE)`,
    )
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

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL

  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required for persistence e2e tests')
  }

  return databaseUrl
}

function databaseUrlFor(databaseUrl: string, databaseName: string): string {
  const url = new URL(databaseUrl)
  url.pathname = `/${databaseName}`
  url.searchParams.delete('schema')
  return url.toString()
}

async function runDatabaseAdminStatement(
  databaseUrl: string,
  statement: string,
): Promise<void> {
  const client = new Client({
    connectionString: databaseUrlFor(databaseUrl, 'postgres'),
  })
  await client.connect()

  try {
    await client.query(statement)
  } finally {
    await client.end()
  }
}

async function applyMigrations(databaseUrl: string): Promise<void> {
  const migrationsDirectory = join(process.cwd(), 'prisma', 'migrations')
  const migrationDirectories = (
    await readdir(migrationsDirectory, {
      withFileTypes: true,
    })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    for (const migrationDirectory of migrationDirectories) {
      const sql = await readFile(
        join(migrationsDirectory, migrationDirectory, 'migration.sql'),
        'utf8',
      )
      await client.query(sql)
    }
  } finally {
    await client.end()
  }
}
