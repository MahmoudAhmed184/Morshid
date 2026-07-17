import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import type { ConfigService } from '@nestjs/config'
import { Client } from 'pg'

import type { AppEnvironment } from '../src/modules/config/env.schema'
import { AuditService } from '../src/modules/audit/audit.service'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { StudentChatAuditService } from '../src/modules/student-chat/student-chat.audit.service'
import {
  PrismaStudentChatMessageRepository,
  type StudentChatMessageRepository,
} from '../src/modules/student-chat/student-chat-message.repository'
import {
  PrismaStudentChatSessionRepository,
  type StudentChatSessionRepository,
} from '../src/modules/student-chat/student-chat-session.repository'

interface EnrolledStudent {
  courseId: string
  studentId: string
}

describe('Student chat repositories (e2e)', () => {
  let originalDatabaseUrl: string
  let disposableDatabaseName: string
  let prisma: PrismaService
  let sessionRepository: StudentChatSessionRepository
  let messageRepository: StudentChatMessageRepository

  beforeAll(async () => {
    originalDatabaseUrl = requireDatabaseUrl()
    disposableDatabaseName = `morshid_issue84_${randomUUID().replaceAll('-', '')}`
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

    const studentChatAuditService = new StudentChatAuditService(
      new AuditService(prisma),
    )
    sessionRepository = new PrismaStudentChatSessionRepository(
      prisma,
      studentChatAuditService,
    )
    messageRepository = new PrismaStudentChatMessageRepository(prisma)
  })

  afterAll(async () => {
    try {
      await disconnectQuietly(prisma)
    } finally {
      await runDatabaseAdminStatement(
        originalDatabaseUrl,
        `DROP DATABASE IF EXISTS "${disposableDatabaseName}" WITH (FORCE)`,
      )
    }
  })

  async function createEnrolledStudent(): Promise<EnrolledStudent> {
    const student = await prisma.user.create({
      data: {
        email: `issue84-${randomUUID()}@morshid.test`,
        displayName: 'Issue 84 student',
        role: 'STUDENT',
        passwordHash: 'test-password-hash',
      },
    })
    const course = await prisma.course.create({
      data: {
        code: `I84-${randomUUID().slice(0, 24)}`,
        title: 'Issue 84 test course',
        createdById: student.id,
      },
    })
    await prisma.courseMembership.create({
      data: {
        courseId: course.id,
        userId: student.id,
        role: 'STUDENT',
        createdById: student.id,
      },
    })

    return { courseId: course.id, studentId: student.id }
  }

  it('assigns unique, gap-free sequences to concurrent appends in real transactions', async () => {
    const { courseId, studentId } = await createEnrolledStudent()
    const session = await sessionRepository.createSession(
      courseId,
      studentId,
      'Concurrency',
    )
    if (session === null) {
      throw new Error('Expected the session to be created')
    }
    const sessionId = session.id

    const appends = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        messageRepository.appendStudentMessage({
          courseId,
          sessionId,
          studentId,
          content: `Message ${String(index)}`,
        }),
      ),
    )

    const sequences = appends.map((result) =>
      result.kind === 'ok' ? result.message.sequence : -1,
    )
    expect([...sequences].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ])
    // The unique(session_id, sequence) constraint plus row locking guarantees
    // no duplicates even though all twelve transactions ran concurrently.
    expect(new Set(sequences).size).toBe(12)

    const persisted = await prisma.message.findMany({
      where: { sessionId },
      select: { sequence: true },
      orderBy: { sequence: 'asc' },
    })
    expect(persisted.map((row) => row.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ])
    const reloaded = await prisma.chatSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { lastSequence: true },
    })
    expect(reloaded.lastSequence).toBe(12)
  })

  it('keeps the chat-session FK satisfied when a membership is soft-removed and reactivated (H1)', async () => {
    const { courseId, studentId } = await createEnrolledStudent()
    const session = await sessionRepository.createSession(
      courseId,
      studentId,
      'Soft removal',
    )
    if (session === null) {
      throw new Error('Expected the session to be created')
    }
    const sessionId = session.id

    await expect(
      sessionRepository.hasActiveStudentMembership(courseId, studentId),
    ).resolves.toBe(true)

    // Soft-remove the membership (what admin removal now does): the row stays,
    // so the composite chat_sessions(course_id, student_id) FK is still valid.
    await prisma.courseMembership.update({
      where: { courseId_userId: { courseId, userId: studentId } },
      data: { removedAt: new Date() },
    })

    await expect(
      sessionRepository.hasActiveStudentMembership(courseId, studentId),
    ).resolves.toBe(false)
    // The session is not orphaned and writes are denied while removed.
    await expect(
      prisma.chatSession.findUnique({ where: { id: sessionId } }),
    ).resolves.not.toBeNull()
    await expect(
      messageRepository.appendStudentMessage({
        courseId,
        sessionId,
        studentId,
        content: 'Should be denied',
      }),
    ).resolves.toEqual({ kind: 'membership_missing' })

    // A hard delete, by contrast, is blocked by the FK while a session exists —
    // which is why removal must be soft.
    await expect(
      prisma.courseMembership.delete({
        where: { courseId_userId: { courseId, userId: studentId } },
      }),
    ).rejects.toThrow()

    // Re-adding the member reactivates access (removedAt cleared).
    await prisma.courseMembership.update({
      where: { courseId_userId: { courseId, userId: studentId } },
      data: { removedAt: null },
    })
    await expect(
      sessionRepository.hasActiveStudentMembership(courseId, studentId),
    ).resolves.toBe(true)
    const reactivated = await messageRepository.appendStudentMessage({
      courseId,
      sessionId,
      studentId,
      content: 'Allowed again',
    })
    expect(reactivated.kind).toBe('ok')
  })

  it('records a deny-path audit for an unknown course without violating the course FK (H2)', async () => {
    const { studentId } = await createEnrolledStudent()
    const studentChatAuditService = new StudentChatAuditService(
      new AuditService(prisma),
    )
    const unknownCourseId = randomUUID()

    // A raw course id that does not exist must never reach the audit_logs
    // course_id FK column directly.
    await expect(
      prisma.auditLog.create({
        data: {
          actorUserId: studentId,
          action: 'chat.session_access_denied',
          targetType: 'chat_session',
          courseId: unknownCourseId,
          metadata: {},
        },
      }),
    ).rejects.toThrow()

    // The FK-safe path keeps the unverified id in JSONB metadata and leaves the
    // FK column null, so the audit event is preserved and no 500 is produced.
    await expect(
      studentChatAuditService.recordAccessDenied({
        actorUserId: studentId,
        courseId: null,
        unverifiedCourseId: unknownCourseId,
        reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
      }),
    ).resolves.toBeUndefined()

    const denials = await prisma.auditLog.findMany({
      where: {
        actorUserId: studentId,
        action: 'chat.session_access_denied',
        courseId: null,
      },
    })
    expect(denials).toHaveLength(1)
    expect(denials[0].courseId).toBeNull()
    expect(denials[0].metadata).toMatchObject({
      reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
      unverifiedCourseId: unknownCourseId,
    })
  })

  it('backfills last_sequence from existing messages so later appends do not collide', async () => {
    const { courseId, studentId } = await createEnrolledStudent()
    const withHistory = await prisma.chatSession.create({
      data: { courseId, studentId, title: 'Pre-backfill history' },
      select: { id: true, lastSequence: true },
    })
    const empty = await prisma.chatSession.create({
      data: { courseId, studentId, title: 'Pre-backfill empty' },
      select: { id: true },
    })
    // Simulate the pre-backfill state: messages exist but last_sequence is still
    // the column default of 0 (the migration added the column before this).
    for (const sequence of [1, 2, 3]) {
      await prisma.message.create({
        data: {
          sessionId: withHistory.id,
          sequence,
          role: 'STUDENT',
          authorUserId: studentId,
          content: `History ${String(sequence)}`,
          status: 'COMPLETED',
        },
      })
    }
    expect(withHistory.lastSequence).toBe(0)

    // Without the backfill, the next append reuses sequence 1 and violates the
    // unique constraint.
    await expect(
      messageRepository.appendStudentMessage({
        courseId,
        sessionId: withHistory.id,
        studentId,
        content: 'Colliding append',
      }),
    ).rejects.toThrow()

    // Run the exact backfill statement shipped in the migration.
    await prisma.$executeRawUnsafe(await readBackfillStatement())

    const [historyAfter, emptyAfter] = await Promise.all([
      prisma.chatSession.findUniqueOrThrow({
        where: { id: withHistory.id },
        select: { lastSequence: true },
      }),
      prisma.chatSession.findUniqueOrThrow({
        where: { id: empty.id },
        select: { lastSequence: true },
      }),
    ])
    expect(historyAfter.lastSequence).toBe(3)
    expect(emptyAfter.lastSequence).toBe(0)

    // After the backfill the next append continues the sequence cleanly.
    const appended = await messageRepository.appendStudentMessage({
      courseId,
      sessionId: withHistory.id,
      studentId,
      content: 'Post-backfill append',
    })
    expect(appended.kind === 'ok' ? appended.message.sequence : -1).toBe(4)
  })
})

async function readBackfillStatement(): Promise<string> {
  const migrationPath = join(
    process.cwd(),
    'prisma',
    'migrations',
    '20260714114707_add_chat_sequence_and_membership_removed_at',
    'migration.sql',
  )
  const sql = await readFile(migrationPath, 'utf8')
  const match = /UPDATE "chat_sessions"[\s\S]*?;/.exec(sql)

  if (match === null) {
    throw new Error('Could not find the last_sequence backfill statement')
  }

  return match[0]
}

async function disconnectQuietly(
  client: PrismaService | undefined,
): Promise<void> {
  if (client === undefined) {
    return
  }

  await client.$disconnect()
}

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
    await readdir(migrationsDirectory, { withFileTypes: true })
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
