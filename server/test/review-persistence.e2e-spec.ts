import { randomUUID } from 'node:crypto'

import { AuditService } from '../src/modules/audit/audit.service'
import { PrismaReviewCaseRepository } from '../src/modules/reviews/review-case.repository'
import { seedP0DemoData } from '../src/seeds/p0-demo.seed'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

describe('Review persistence seam (e2e)', () => {
  let database: DisposableDatabase | undefined
  let repository: PrismaReviewCaseRepository

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue136_review')
    await seedP0DemoData(database.prisma)
    repository = new PrismaReviewCaseRepository(
      database.prisma,
      new AuditService(database.prisma),
    )
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('applies the review schema on a clean seeded database with its critical indexes and enum contracts', async () => {
    const prisma = requireDatabase().prisma
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'review_cases',
          'review_triggers',
          'review_evidence_snapshots',
          'review_actions',
          'notifications',
          'idempotency_records'
        )
      ORDER BY table_name
    `
    expect(tables.map(({ table_name }) => table_name)).toEqual([
      'idempotency_records',
      'notifications',
      'review_actions',
      'review_cases',
      'review_evidence_snapshots',
      'review_triggers',
    ])

    const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'review_cases_target_message_id_key',
          'idx_review_cases_course_status_created',
          'review_triggers_manual_actor_case_key',
          'review_triggers_source_event_key_key',
          'review_actions_case_version_key',
          'notifications_terminal_review_key',
          'idx_notifications_recipient_active',
          'idx_notifications_recipient_unread'
        )
      ORDER BY indexname
    `
    expect(indexes.map(({ indexname }) => indexname)).toHaveLength(8)

    const reviewStatuses = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'review_status'
      ORDER BY enumsortorder
    `
    expect(reviewStatuses.map(({ enumlabel }) => enumlabel)).toEqual([
      'PENDING',
      'IN_REVIEW',
      'RESOLVED',
      'REJECTED',
    ])
  })

  it('resolves concurrent manual attempts for one assistant message to one durable case', async () => {
    const fixture = await createReviewableMessage('concurrent')

    const [first, second] = await Promise.all([
      repository.create({
        kind: 'manual',
        messageId: fixture.assistantMessageId,
        actorUserId: fixture.studentId,
        reason: 'Please verify',
        idempotencyKey: 'concurrent-a',
      }),
      repository.create({
        kind: 'manual',
        messageId: fixture.assistantMessageId,
        actorUserId: fixture.studentId,
        reason: 'Please verify',
        idempotencyKey: 'concurrent-b',
      }),
    ])

    expect(first.kind).toBe('ok')
    expect(second.kind).toBe('ok')
    if (first.kind !== 'ok' || second.kind !== 'ok') {
      throw new Error('Expected both concurrent review requests to succeed')
    }
    expect(first.record.caseId).toBe(second.record.caseId)
    expect(
      await requireDatabase().prisma.reviewCase.count({
        where: { targetMessageId: fixture.assistantMessageId },
      }),
    ).toBe(1)
    expect(
      await requireDatabase().prisma.reviewTrigger.count({
        where: { reviewCaseId: first.record.caseId },
      }),
    ).toBe(1)
    expect(
      await requireDatabase().prisma.reviewEvidenceSnapshot.count({
        where: { reviewCaseId: first.record.caseId },
      }),
    ).toBe(1)
  })

  it('replays an exact idempotency key and rejects a changed fingerprint without extra rows', async () => {
    const fixture = await createReviewableMessage('idempotency')
    const input = {
      kind: 'manual' as const,
      messageId: fixture.assistantMessageId,
      actorUserId: fixture.studentId,
      reason: null,
      idempotencyKey: 'stable-key',
    }

    const created = await repository.create(input)
    const replay = await repository.create(input)
    const conflict = await repository.create({
      ...input,
      reason: 'Different request',
    })

    expect(created.kind).toBe('ok')
    expect(replay.kind).toBe('ok')
    if (created.kind !== 'ok' || replay.kind !== 'ok') {
      throw new Error('Expected idempotent creation and replay to succeed')
    }
    expect(replay.record).toMatchObject({
      caseId: created.record.caseId,
      replayed: true,
    })
    expect(conflict).toEqual({ kind: 'idempotency_conflict' })
    expect(
      await requireDatabase().prisma.reviewCase.count({
        where: { targetMessageId: fixture.assistantMessageId },
      }),
    ).toBe(1)
    expect(
      await requireDatabase().prisma.idempotencyRecord.count({
        where: { actorUserId: fixture.studentId, key: 'stable-key' },
      }),
    ).toBe(1)
  })

  it('derives course ownership, conceals a foreign Student target, and rejects oversized evidence atomically', async () => {
    const owned = await createReviewableMessage('ownership')
    const foreign = await createReviewableMessage('foreign')

    const created = await repository.create({
      kind: 'manual',
      messageId: owned.assistantMessageId,
      actorUserId: owned.studentId,
      reason: null,
      idempotencyKey: 'owned-key',
    })
    expect(created.kind).toBe('ok')
    if (created.kind !== 'ok') {
      throw new Error('Expected owned review target to succeed')
    }
    expect(
      await requireDatabase().prisma.reviewCase.findUniqueOrThrow({
        where: { id: created.record.caseId },
        select: { courseId: true, requestedByUserId: true },
      }),
    ).toEqual({
      courseId: owned.courseId,
      requestedByUserId: owned.studentId,
    })

    await expect(
      repository.create({
        kind: 'manual',
        messageId: owned.assistantMessageId,
        actorUserId: foreign.studentId,
        reason: null,
        idempotencyKey: 'foreign-key',
      }),
    ).resolves.toEqual({ kind: 'not_found' })

    const oversized = await createReviewableMessage(
      'oversized',
      'x'.repeat(129 * 1024),
    )
    await expect(
      repository.create({
        kind: 'automatic',
        messageId: oversized.assistantMessageId,
        trigger: 'POLICY_CHECK_FAILED',
        sourceEventKey: 'oversized-event',
        evidence: { summary: 'Policy threshold was not met' },
        detectorMetadata: { detector: 'test' },
      }),
    ).resolves.toEqual({ kind: 'snapshot_too_large' })
    expect(
      await requireDatabase().prisma.reviewCase.count({
        where: { targetMessageId: oversized.assistantMessageId },
      }),
    ).toBe(0)
  })

  async function createReviewableMessage(label: string, content = 'Answer') {
    const studentId = randomUUID()
    const courseId = randomUUID()
    const sessionId = randomUUID()
    const studentMessageId = randomUUID()
    const assistantMessageId = randomUUID()

    const prisma = requireDatabase().prisma
    await prisma.user.create({
      data: {
        id: studentId,
        email: `${label}-${studentId}@review.test`,
        displayName: `${label} Student`,
        role: 'STUDENT',
        passwordHash: 'test-password-hash',
      },
    })
    await prisma.course.create({
      data: {
        id: courseId,
        code: `REV-${studentId.slice(0, 12)}`,
        title: `${label} Course`,
        createdById: studentId,
      },
    })
    await prisma.courseMembership.create({
      data: {
        courseId,
        userId: studentId,
        role: 'STUDENT',
        createdById: studentId,
      },
    })
    await prisma.chatSession.create({
      data: {
        id: sessionId,
        courseId,
        studentId,
        title: `${label} Session`,
        lastSequence: 2,
      },
    })
    await prisma.message.createMany({
      data: [
        {
          id: studentMessageId,
          sessionId,
          sequence: 1,
          role: 'STUDENT',
          authorUserId: studentId,
          content: 'Question',
          status: 'COMPLETED',
          completedAt: new Date(),
        },
        {
          id: assistantMessageId,
          sessionId,
          sequence: 2,
          role: 'ASSISTANT',
          responseToMessageId: studentMessageId,
          content,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      ],
    })

    return { studentId, courseId, assistantMessageId }
  }

  function requireDatabase(): DisposableDatabase {
    if (database === undefined) {
      throw new Error('Review persistence database was not initialized')
    }
    return database
  }
})
