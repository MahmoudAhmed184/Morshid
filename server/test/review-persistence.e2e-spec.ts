import { randomUUID } from 'node:crypto'

import { StudentFlagReason } from '../src/generated/prisma/client'
import { AuditService } from '../src/modules/audit/audit.service'
import { PrismaDatabaseTransactionRunner } from '../src/modules/prisma/database-transaction'
import { PrismaReviewCaseIntake } from '../src/modules/reviews/review-case-intake'
import { PrismaReviewCaseRepository } from '../src/modules/reviews/review-case.repository'
import type { AutomaticReviewIntakeInput } from '../src/modules/reviews/review-case-intake'
import { seedP0DemoData } from '../src/seeds/p0-demo.seed'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

describe('Review persistence seam (e2e)', () => {
  let database: DisposableDatabase | undefined
  let repository: PrismaReviewCaseRepository
  let reviewCaseIntake: PrismaReviewCaseIntake
  let transactionRunner: PrismaDatabaseTransactionRunner

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue136_review')
    await seedP0DemoData(database.prisma)
    repository = new PrismaReviewCaseRepository(
      database.prisma,
      new AuditService(database.prisma),
    )
    reviewCaseIntake = new PrismaReviewCaseIntake(repository)
    transactionRunner = new PrismaDatabaseTransactionRunner(database.prisma)
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
          'review_inbox_items_recipient_review_case_key',
          'idx_review_inbox_items_recipient_created'
        )
      ORDER BY indexname
    `
    expect(indexes.map(({ indexname }) => indexname)).toHaveLength(7)

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

    const studentFlagReasons = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'student_flag_reason'
      ORDER BY enumsortorder
    `
    expect(studentFlagReasons.map(({ enumlabel }) => enumlabel)).toEqual([
      'INCORRECT',
      'CONFUSING',
      'UNHELPFUL',
      'COURSE_MISMATCH',
      'TOO_MUCH_ANSWER',
      'OTHER',
    ])
  })

  it('resolves concurrent duplicate attempts to one case and consumes quota once', async () => {
    const fixture = await createReviewableMessages('concurrent', 4)
    const [firstMessageId, secondMessageId, thirdMessageId, fourthMessageId] =
      fixture.assistantMessageIds as [string, string, string, string]

    const [first, second] = await Promise.all([
      repository.create({
        kind: 'manual',
        messageId: firstMessageId,
        actorUserId: fixture.studentId,
        flagReason: StudentFlagReason.INCORRECT,
        reason: 'Please verify',
        idempotencyKey: 'concurrent-a',
      }),
      repository.create({
        kind: 'manual',
        messageId: firstMessageId,
        actorUserId: fixture.studentId,
        flagReason: StudentFlagReason.INCORRECT,
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
    await expect(
      requireDatabase().prisma.reviewTrigger.findFirstOrThrow({
        where: { reviewCaseId: first.record.caseId },
        select: { studentFlagReason: true, reason: true },
      }),
    ).resolves.toEqual({
      studentFlagReason: StudentFlagReason.INCORRECT,
      reason: 'Please verify',
    })
    expect(
      await requireDatabase().prisma.reviewCase.count({
        where: { requestedByUserId: fixture.studentId },
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

    for (const [index, messageId] of [
      secondMessageId,
      thirdMessageId,
    ].entries()) {
      await expect(
        repository.create({
          kind: 'manual',
          messageId,
          actorUserId: fixture.studentId,
          flagReason: StudentFlagReason.CONFUSING,
          reason: null,
          idempotencyKey: `concurrent-distinct-${String(index)}`,
        }),
      ).resolves.toMatchObject({ kind: 'ok', record: { status: 'PENDING' } })
    }
    await expect(
      repository.create({
        kind: 'manual',
        messageId: fourthMessageId,
        actorUserId: fixture.studentId,
        flagReason: StudentFlagReason.CONFUSING,
        reason: null,
        idempotencyKey: 'concurrent-fourth',
      }),
    ).resolves.toEqual({ kind: 'quota_exceeded' })
  })

  it('creates three distinct pending cases per UTC day and rejects the fourth atomically', async () => {
    const fixture = await createReviewableMessages('daily-quota', 4)

    for (const [index, messageId] of fixture.assistantMessageIds.entries()) {
      const result = await repository.create({
        kind: 'manual',
        messageId,
        actorUserId: fixture.studentId,
        flagReason: StudentFlagReason.UNHELPFUL,
        reason: `Request ${String(index + 1)}`,
        idempotencyKey: `daily-quota-${String(index + 1)}`,
      })

      if (index < 3) {
        expect(result).toMatchObject({
          kind: 'ok',
          record: { replayed: false, status: 'PENDING' },
        })
      } else {
        expect(result).toEqual({ kind: 'quota_exceeded' })
      }
    }

    expect(
      await requireDatabase().prisma.reviewCase.count({
        where: { requestedByUserId: fixture.studentId },
      }),
    ).toBe(3)
  })

  it('replays an exact idempotency key and rejects a changed fingerprint without extra rows', async () => {
    const fixture = await createReviewableMessage('idempotency')
    const input = {
      kind: 'manual' as const,
      messageId: fixture.assistantMessageId,
      actorUserId: fixture.studentId,
      flagReason: StudentFlagReason.COURSE_MISMATCH,
      reason: null,
      idempotencyKey: 'stable-key',
    }

    const created = await repository.create(input)
    const replay = await repository.create(input)
    const conflict = await repository.create({
      ...input,
      flagReason: StudentFlagReason.TOO_MUCH_ANSWER,
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

  it('enforces Student flag reason trigger shape in the database', async () => {
    const fixture = await createReviewableMessage('trigger-shape')
    const automatic = await openAutomatic({
      messageId: fixture.assistantMessageId,
      triggers: [
        {
          trigger: 'POLICY_CHECK_FAILED',
          sourceEventKey: 'trigger-shape-automatic',
        },
      ],
      evidence: { summary: 'Policy threshold was not met' },
    })

    await expect(
      requireDatabase().prisma.$executeRaw`
        INSERT INTO "review_triggers" (
          "review_case_id",
          "type",
          "student_flag_reason",
          "source_event_key"
        ) VALUES (
          ${automatic.caseId}::uuid,
          'CITATION_MISSING',
          'INCORRECT',
          'trigger-shape-invalid'
        )
      `,
    ).rejects.toThrow()

    const manualFixture = await createReviewableMessage('trigger-shape-manual')
    await expect(
      repository.create({
        kind: 'manual',
        messageId: manualFixture.assistantMessageId,
        actorUserId: manualFixture.studentId,
        flagReason: StudentFlagReason.INCORRECT,
        reason: null,
        idempotencyKey: 'trigger-shape-manual',
      }),
    ).resolves.toMatchObject({ kind: 'ok' })
  })

  it('keeps the first evidence snapshot immutable when automatic reasons aggregate', async () => {
    const fixture = await createReviewableMessage('immutable-automatic')
    const first = await openAutomatic({
      messageId: fixture.assistantMessageId,
      triggers: [
        {
          trigger: 'POLICY_CHECK_FAILED',
          sourceEventKey: 'immutable-automatic-policy',
        },
      ],
      evidence: { summary: 'Initial bounded policy evidence' },
    })
    const original =
      await requireDatabase().prisma.reviewEvidenceSnapshot.findUniqueOrThrow({
        where: { reviewCaseId: first.caseId },
      })

    await expect(
      openAutomatic({
        messageId: fixture.assistantMessageId,
        triggers: [
          {
            trigger: 'FINAL_ANSWER_RISK',
            sourceEventKey: 'immutable-automatic-final-answer',
          },
        ],
        evidence: { summary: 'Later contribution must not replace evidence' },
      }),
    ).resolves.toMatchObject({ caseId: first.caseId })

    const aggregated =
      await requireDatabase().prisma.reviewCase.findUniqueOrThrow({
        where: { id: first.caseId },
        include: {
          evidence: true,
          triggers: { orderBy: { createdAt: 'asc' } },
        },
      })
    expect(aggregated.triggers.map(({ type }) => type)).toEqual([
      'POLICY_CHECK_FAILED',
      'FINAL_ANSWER_RISK',
    ])
    expect(aggregated.evidence).toEqual(original)
    expect(JSON.stringify(aggregated.evidence?.evidence)).toContain(
      '[Redacted policy-review prompt]',
    )
    expect(JSON.stringify(aggregated.evidence?.evidence)).not.toContain(
      'Later contribution must not replace evidence',
    )
  })

  it('normalizes notes and requires a non-empty note only for OTHER', async () => {
    const validOther = await createReviewableMessage('other-valid')
    await expect(
      repository.create({
        kind: 'manual',
        messageId: validOther.assistantMessageId,
        actorUserId: validOther.studentId,
        flagReason: StudentFlagReason.OTHER,
        reason: '  Please check another concern  ',
        idempotencyKey: 'other-valid',
      }),
    ).resolves.toMatchObject({ kind: 'ok' })
    await expect(
      requireDatabase().prisma.reviewTrigger.findFirstOrThrow({
        where: {
          reviewCase: { targetMessageId: validOther.assistantMessageId },
        },
        select: { reason: true },
      }),
    ).resolves.toEqual({ reason: 'Please check another concern' })

    for (const [label, reason] of [
      ['null', null],
      ['blank', '   '],
    ] as const) {
      const invalidOther = await createReviewableMessage(`other-${label}`)
      await expect(
        repository.create({
          kind: 'manual',
          messageId: invalidOther.assistantMessageId,
          actorUserId: invalidOther.studentId,
          flagReason: StudentFlagReason.OTHER,
          reason,
          idempotencyKey: `other-${label}`,
        }),
      ).rejects.toThrow('A non-empty note is required')
      await expect(
        requireDatabase().prisma.reviewCase.count({
          where: { targetMessageId: invalidOther.assistantMessageId },
        }),
      ).resolves.toBe(0)
    }

    const optionalNote = await createReviewableMessage('optional-note')
    await expect(
      repository.create({
        kind: 'manual',
        messageId: optionalNote.assistantMessageId,
        actorUserId: optionalNote.studentId,
        flagReason: StudentFlagReason.CONFUSING,
        reason: '   ',
        idempotencyKey: 'optional-note',
      }),
    ).resolves.toMatchObject({ kind: 'ok' })
    await expect(
      requireDatabase().prisma.reviewTrigger.findFirstOrThrow({
        where: {
          reviewCase: { targetMessageId: optionalNote.assistantMessageId },
        },
        select: { reason: true },
      }),
    ).resolves.toEqual({ reason: null })
  })

  it('derives course ownership, conceals a foreign Student target, and rejects oversized evidence atomically', async () => {
    const owned = await createReviewableMessage('ownership')
    const foreign = await createReviewableMessage('foreign')

    const created = await repository.create({
      kind: 'manual',
      messageId: owned.assistantMessageId,
      actorUserId: owned.studentId,
      flagReason: StudentFlagReason.INCORRECT,
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
        flagReason: StudentFlagReason.INCORRECT,
        reason: null,
        idempotencyKey: 'foreign-key',
      }),
    ).resolves.toEqual({ kind: 'not_found' })

    const oversized = await createReviewableMessage(
      'oversized',
      'x'.repeat(129 * 1024),
    )
    await expect(
      openAutomatic({
        messageId: oversized.assistantMessageId,
        triggers: [
          {
            trigger: 'POLICY_CHECK_FAILED',
            sourceEventKey: 'oversized-event',
            detectorMetadata: { detector: 'test' },
          },
        ],
        evidence: { summary: 'Policy threshold was not met' },
      }),
    ).rejects.toMatchObject({ response: { code: 'REVIEW_SNAPSHOT_TOO_LARGE' } })
    expect(
      await requireDatabase().prisma.reviewCase.count({
        where: { targetMessageId: oversized.assistantMessageId },
      }),
    ).toBe(0)
  })

  it('rolls back automatic review intake with the caller-owned transaction', async () => {
    const fixture = await createReviewableMessage('atomic-automatic-batch')

    await expect(
      transactionRunner.run(async (transaction) => {
        await reviewCaseIntake.openAutomatic(
          {
            messageId: fixture.assistantMessageId,
            triggers: [
              {
                trigger: 'POLICY_CHECK_FAILED',
                sourceEventKey: 'atomic-batch-valid',
              },
              {
                trigger: 'FINAL_ANSWER_RISK',
                sourceEventKey: 'atomic-batch-second',
              },
            ],
            evidence: { summary: 'Atomic review intake' },
          },
          transaction,
        )
        throw new Error('force finalization rollback')
      }),
    ).rejects.toThrow('force finalization rollback')

    await expect(
      requireDatabase().prisma.reviewCase.count({
        where: { targetMessageId: fixture.assistantMessageId },
      }),
    ).resolves.toBe(0)
    await expect(
      requireDatabase().prisma.reviewTrigger.count({
        where: { sourceEventKey: 'atomic-batch-valid' },
      }),
    ).resolves.toBe(0)
  })

  async function openAutomatic(input: AutomaticReviewIntakeInput) {
    return transactionRunner.run((transaction) =>
      reviewCaseIntake.openAutomatic(input, transaction),
    )
  }

  async function createReviewableMessage(label: string, content = 'Answer') {
    const fixture = await createReviewableMessages(label, 1, content)
    return {
      studentId: fixture.studentId,
      courseId: fixture.courseId,
      assistantMessageId: fixture.assistantMessageIds[0],
    }
  }

  async function createReviewableMessages(
    label: string,
    count: number,
    content = 'Answer',
  ) {
    const studentId = randomUUID()
    const courseId = randomUUID()
    const sessionId = randomUUID()
    const assistantMessageIds: string[] = []

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
        lastSequence: count * 2,
      },
    })
    const messages = Array.from({ length: count }, (_, index) => {
      const studentMessageId = randomUUID()
      const assistantMessageId = randomUUID()
      assistantMessageIds.push(assistantMessageId)
      return [
        {
          id: studentMessageId,
          sessionId,
          sequence: index * 2 + 1,
          role: 'STUDENT' as const,
          authorUserId: studentId,
          content: 'Question',
          status: 'COMPLETED' as const,
          completedAt: new Date(),
        },
        {
          id: assistantMessageId,
          sessionId,
          sequence: index * 2 + 2,
          role: 'ASSISTANT' as const,
          responseToMessageId: studentMessageId,
          content,
          status: 'COMPLETED' as const,
          completedAt: new Date(),
        },
      ]
    }).flat()
    await prisma.message.createMany({
      data: messages,
    })

    return { studentId, courseId, assistantMessageIds }
  }

  function requireDatabase(): DisposableDatabase {
    if (database === undefined) {
      throw new Error('Review persistence database was not initialized')
    }
    return database
  }
})
