import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { StudentFlagReason } from '../../src/generated/prisma/client'
import { AuditService } from '../../src/modules/audit/audit.service'
import { PrismaReviewCaseRepository } from '../../src/modules/reviews/review-case.repository'
import { PrismaActiveCourseMembership } from '../../src/modules/courses/active-course-membership'
import {
  P0_DEMO_COURSE,
  P0_HIDDEN_ISOLATION_COURSE,
} from '../../src/seeds/p0-demo.seed'
import { P0_REVIEW_READINESS_FIXTURE } from '../../src/seeds/p0-review-readiness.seed'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'

const execFileAsync = promisify(execFile)

describe('Fresh migration and seed manual review readiness (e2e)', () => {
  let database: DisposableDatabase | undefined

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue140_fresh_review', {
      applyMigrations: false,
    })

    await runServerCommand('db:migrate:deploy')
    await runServerCommand('db:seed')
    await runPrismaCommand([
      'migrate',
      'status',
      '--config',
      'prisma.config.ts',
    ])
  }, 120_000)

  afterAll(async () => {
    await database?.dispose()
  })

  it('applies every committed migration without drift and exposes review schema contracts', async () => {
    const prisma = requireDatabase().prisma
    const migrationDirectories = (
      await readdir(join(process.cwd(), 'prisma', 'migrations'), {
        withFileTypes: true,
      })
    ).filter((entry) => entry.isDirectory())
    const migrations = await prisma.$queryRaw<
      { finished_at: Date | null; rolled_back_at: Date | null }[]
    >`
      SELECT finished_at, rolled_back_at
      FROM "_prisma_migrations"
    `
    expect(migrations).toHaveLength(migrationDirectories.length)
    for (const migration of migrations) {
      expect(migration.finished_at).toBeInstanceOf(Date)
      expect(migration.rolled_back_at).toBeNull()
    }

    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'review_cases',
          'review_triggers',
          'review_evidence_snapshots',
          'review_actions',
          'review_inbox_items',
          'idempotency_records'
        )
      ORDER BY table_name
    `
    expect(tables.map(({ table_name }) => table_name)).toEqual([
      'idempotency_records',
      'review_actions',
      'review_cases',
      'review_evidence_snapshots',
      'review_inbox_items',
      'review_triggers',
    ])

    const enums = await prisma.$queryRaw<
      { enum_name: string; enum_value: string }[]
    >`
      SELECT pg_type.typname AS enum_name, pg_enum.enumlabel AS enum_value
      FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname IN (
        'review_status',
        'review_trigger_type',
        'student_flag_reason'
      )
      ORDER BY pg_type.typname, pg_enum.enumsortorder
    `
    expect(enums).toEqual(
      expect.arrayContaining([
        { enum_name: 'review_status', enum_value: 'PENDING' },
        { enum_name: 'review_trigger_type', enum_value: 'STUDENT_REQUEST' },
        { enum_name: 'student_flag_reason', enum_value: 'INCORRECT' },
      ]),
    )

    const constraintIndexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'review_cases_target_message_id_key',
          'review_triggers_manual_actor_case_key',
          'review_actions_case_version_key',
          'review_inbox_items_recipient_review_case_key',
          'idempotency_records_actor_scope_key_key'
        )
      ORDER BY indexname
    `
    expect(constraintIndexes).toHaveLength(5)
  })

  it('seeds deterministic identities, ownership, enrollment, and eligible exchanges', async () => {
    const prisma = requireDatabase().prisma
    const instructor = await prisma.user.findUniqueOrThrow({
      where: { email: 'instructor@morshid.demo' },
    })
    const student1 = await prisma.user.findUniqueOrThrow({
      where: { email: P0_REVIEW_READINESS_FIXTURE.owned.studentEmail },
    })
    const student2 = await prisma.user.findUniqueOrThrow({
      where: { email: P0_REVIEW_READINESS_FIXTURE.foreign.studentEmail },
    })
    expect(instructor.role).toBe('INSTRUCTOR')
    expect([student1.role, student2.role]).toEqual(['STUDENT', 'STUDENT'])

    const course = await prisma.course.findUniqueOrThrow({
      where: { code: P0_DEMO_COURSE.code },
      include: { memberships: true },
    })
    expect(course.createdById).toBe(instructor.id)
    expect(course.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: student1.id,
          role: 'STUDENT',
          removedAt: null,
        }),
        expect.objectContaining({
          userId: student2.id,
          role: 'STUDENT',
          removedAt: null,
        }),
      ]),
    )
    await expect(
      prisma.course.findUniqueOrThrow({
        where: { code: P0_HIDDEN_ISOLATION_COURSE.code },
        include: { memberships: true },
      }),
    ).resolves.toMatchObject({ createdById: null, memberships: [] })

    for (const fixture of [
      P0_REVIEW_READINESS_FIXTURE.owned,
      P0_REVIEW_READINESS_FIXTURE.foreign,
    ]) {
      await expect(
        prisma.message.findUniqueOrThrow({
          where: { id: fixture.assistantMessageId },
          select: {
            role: true,
            status: true,
            completedAt: true,
            responseToMessageId: true,
            session: { select: { student: { select: { email: true } } } },
          },
        }),
      ).resolves.toEqual({
        role: 'ASSISTANT',
        status: 'COMPLETED',
        completedAt: P0_REVIEW_READINESS_FIXTURE.completedAt,
        responseToMessageId: fixture.studentMessageId,
        session: { student: { email: fixture.studentEmail } },
      })
    }
  })

  it('starts clean and enforces owned-only manual review targeting', async () => {
    const prisma = requireDatabase().prisma
    const student = await prisma.user.findUniqueOrThrow({
      where: { email: P0_REVIEW_READINESS_FIXTURE.owned.studentEmail },
    })
    await expect(prisma.reviewCase.count()).resolves.toBe(0)
    await expect(prisma.reviewTrigger.count()).resolves.toBe(0)
    await expect(prisma.reviewInboxItem.count()).resolves.toBe(0)
    await expect(prisma.idempotencyRecord.count()).resolves.toBe(0)

    const repository = new PrismaReviewCaseRepository(
      prisma,
      new AuditService(prisma),
      new PrismaActiveCourseMembership(),
    )
    await expect(
      repository.create({
        kind: 'manual',
        messageId: P0_REVIEW_READINESS_FIXTURE.foreign.assistantMessageId,
        actorUserId: student.id,
        flagReason: StudentFlagReason.INCORRECT,
        reason: null,
        idempotencyKey: 'fresh-seed-foreign',
      }),
    ).resolves.toEqual({ kind: 'not_found' })
    await expect(prisma.reviewCase.count()).resolves.toBe(0)

    await expect(
      repository.create({
        kind: 'manual',
        messageId: P0_REVIEW_READINESS_FIXTURE.owned.assistantMessageId,
        actorUserId: student.id,
        flagReason: StudentFlagReason.INCORRECT,
        reason: 'Fresh seed readiness proof',
        idempotencyKey: 'fresh-seed-owned',
      }),
    ).resolves.toMatchObject({
      kind: 'ok',
      record: {
        messageId: P0_REVIEW_READINESS_FIXTURE.owned.assistantMessageId,
        status: 'PENDING',
        replayed: false,
      },
    })
    await expect(
      prisma.reviewCase.count({ where: { requestedByUserId: student.id } }),
    ).resolves.toBe(1)
    await expect(prisma.reviewInboxItem.count()).resolves.toBe(0)
  })

  async function runServerCommand(script: string): Promise<void> {
    await execFileAsync('npm', ['run', script], {
      cwd: process.cwd(),
      env: commandEnvironment(),
      timeout: 120_000,
    })
  }

  async function runPrismaCommand(args: string[]): Promise<void> {
    await execFileAsync('npx', ['prisma', ...args], {
      cwd: process.cwd(),
      env: commandEnvironment(),
      timeout: 120_000,
    })
  }

  function commandEnvironment(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      DATABASE_URL: requireDatabase().databaseUrl,
    }
  }

  function requireDatabase(): DisposableDatabase {
    if (database === undefined) {
      throw new Error('Fresh review database was not initialized')
    }
    return database
  }
})
