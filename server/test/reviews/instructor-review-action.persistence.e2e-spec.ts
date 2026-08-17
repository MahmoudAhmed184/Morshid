import { randomUUID } from 'node:crypto'

import { Client } from 'pg'

import { ReviewOutcome } from '../../src/generated/prisma/client'
import { CourseAudit } from '../../src/modules/courses/course-audit'
import { PrismaActiveCourseMembership } from '../../src/modules/courses/active-course-membership'
import { PrismaCoursesRepository } from '../../src/modules/courses/courses.repository'
import { PrismaInstructorReviewActionRepository } from '../../src/modules/reviews/instructor-resolution/instructor-review-action.repository'
import { AuditService } from '../../src/modules/audit/audit.service'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'

describe('Instructor terminal review actions (e2e)', () => {
  let database: DisposableDatabase | undefined
  let repository: PrismaInstructorReviewActionRepository

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue139_actions')
    repository = new PrismaInstructorReviewActionRepository(
      requireDatabase().prisma,
      new AuditService(requireDatabase().prisma),
      new PrismaActiveCourseMembership(),
    )
  })

  afterAll(async () => database?.dispose())

  it.each([
    [ReviewOutcome.APPROVED, null, 'Original immutable answer'],
    [ReviewOutcome.EDITED, 'Edited guidance', 'Edited guidance'],
    [ReviewOutcome.REPLACED, 'Replacement guidance', 'Replacement guidance'],
  ] as const)(
    'publishes %s, keeps the original message immutable, and appends one action',
    async (outcome, content, expectedPublishedContent) => {
      const fixture = await createCase()
      const result = await repository.apply({
        kind: 'resolve',
        reviewCaseId: fixture.reviewCaseId,
        instructorId: fixture.instructorId,
        idempotencyKey: `resolve-${outcome}`,
        request: { expectedVersion: 1, outcome, content, reason: null },
      })

      expect(result).toMatchObject({
        kind: 'ok',
        record: {
          outcome,
          publishedContent: expectedPublishedContent,
          status: 'RESOLVED',
          version: 2,
          replayed: false,
        },
      })
      expect(
        await requireDatabase().prisma.message.findUniqueOrThrow({
          where: { id: fixture.assistantMessageId },
          select: { content: true },
        }),
      ).toEqual({ content: 'Original immutable answer' })
      expect(
        await requireDatabase().prisma.reviewAction.count({
          where: { reviewCaseId: fixture.reviewCaseId },
        }),
      ).toBe(2)
      expect(
        await requireDatabase().prisma.reviewInboxItem.findMany({
          where: { reviewCaseId: fixture.reviewCaseId },
          select: { recipientUserId: true, type: true, status: true },
        }),
      ).toEqual([
        {
          recipientUserId: fixture.studentId,
          type: 'REVIEW_RESOLVED',
          status: 'UNREAD',
        },
      ])
      await expect(
        requireDatabase().prisma.auditLog.count({
          where: {
            action: 'review.case_resolved',
            actorUserId: fixture.instructorId,
            targetId: fixture.reviewCaseId,
          },
        }),
      ).resolves.toBe(1)
    },
  )

  it('rejects a manual request with a required reason', async () => {
    const fixture = await createCase()

    await expect(
      repository.apply({
        kind: 'reject',
        reviewCaseId: fixture.reviewCaseId,
        instructorId: fixture.instructorId,
        idempotencyKey: 'reject-manual',
        request: { expectedVersion: 1, reason: 'The request is not valid' },
      }),
    ).resolves.toMatchObject({
      kind: 'ok',
      record: {
        status: 'REJECTED',
        outcome: 'REQUEST_REJECTED',
        resolutionReason: 'The request is not valid',
      },
    })
    expect(
      await requireDatabase().prisma.reviewInboxItem.findMany({
        where: { reviewCaseId: fixture.reviewCaseId },
        select: { recipientUserId: true, type: true },
      }),
    ).toEqual([
      {
        recipientUserId: fixture.studentId,
        type: 'REVIEW_REJECTED',
      },
    ])
    await expect(
      requireDatabase().prisma.auditLog.count({
        where: {
          action: 'review.case_rejected',
          actorUserId: fixture.instructorId,
          targetId: fixture.reviewCaseId,
        },
      }),
    ).resolves.toBe(1)
  })

  it('allows an expired idempotency key to resolve a different case', async () => {
    const first = await createCase()
    await repository.apply({
      kind: 'resolve',
      reviewCaseId: first.reviewCaseId,
      instructorId: first.instructorId,
      idempotencyKey: 'expired-resolve-key',
      request: {
        expectedVersion: 1,
        outcome: ReviewOutcome.APPROVED,
        content: null,
        reason: null,
      },
    })
    await requireDatabase().prisma.idempotencyRecord.updateMany({
      where: {
        actorUserId: first.instructorId,
        operationScope: 'review.resolve',
        key: 'expired-resolve-key',
      },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    })
    const second = await createCase()

    await expect(
      repository.apply({
        kind: 'resolve',
        reviewCaseId: second.reviewCaseId,
        instructorId: second.instructorId,
        idempotencyKey: 'expired-resolve-key',
        request: {
          expectedVersion: 1,
          outcome: ReviewOutcome.APPROVED,
          content: null,
          reason: null,
        },
      }),
    ).resolves.toMatchObject({ kind: 'ok', record: { replayed: false } })
  })

  it('conceals an unowned case and rejects stale or terminal transitions', async () => {
    const fixture = await createCase()
    const stranger = await createInstructor()
    const request = {
      expectedVersion: 1,
      outcome: ReviewOutcome.APPROVED,
      content: null,
      reason: null,
    }

    await expect(
      repository.apply({
        kind: 'resolve',
        reviewCaseId: fixture.reviewCaseId,
        instructorId: stranger,
        idempotencyKey: 'unowned',
        request,
      }),
    ).resolves.toEqual({ kind: 'not_found' })
    await expect(
      repository.apply({
        kind: 'resolve',
        reviewCaseId: fixture.reviewCaseId,
        instructorId: fixture.instructorId,
        idempotencyKey: 'stale',
        request: { ...request, expectedVersion: 2 },
      }),
    ).resolves.toEqual({ kind: 'stale_version' })

    await repository.apply({
      kind: 'resolve',
      reviewCaseId: fixture.reviewCaseId,
      instructorId: fixture.instructorId,
      idempotencyKey: 'terminal-first',
      request,
    })
    await expect(
      repository.apply({
        kind: 'resolve',
        reviewCaseId: fixture.reviewCaseId,
        instructorId: fixture.instructorId,
        idempotencyKey: 'terminal-second',
        request,
      }),
    ).resolves.toEqual({ kind: 'invalid_transition' })
  })

  it('replays the same operation without another action', async () => {
    const fixture = await createCase()
    const input = {
      kind: 'resolve' as const,
      reviewCaseId: fixture.reviewCaseId,
      instructorId: fixture.instructorId,
      idempotencyKey: 'stable-resolution-key',
      request: {
        expectedVersion: 1,
        outcome: ReviewOutcome.EDITED,
        content: 'Corrected once',
        reason: null,
      },
    }

    await expect(repository.apply(input)).resolves.toMatchObject({
      kind: 'ok',
      record: { replayed: false },
    })
    await expect(repository.apply(input)).resolves.toMatchObject({
      kind: 'ok',
      record: { replayed: true, publishedContent: 'Corrected once' },
    })
    expect(
      await requireDatabase().prisma.reviewAction.count({
        where: { reviewCaseId: fixture.reviewCaseId },
      }),
    ).toBe(2)
    expect(
      await requireDatabase().prisma.reviewInboxItem.count({
        where: { reviewCaseId: fixture.reviewCaseId },
      }),
    ).toBe(1)
  })

  it.each(['resolve', 'reject'] as const)(
    'holds instructor authorization through a concurrent %s commit',
    async (kind) => {
      const fixture = await createCase()
      const prisma = requireDatabase().prisma
      const auditService = new AuditService(prisma)
      const courses = new PrismaCoursesRepository(
        prisma,
        new CourseAudit(auditService),
      )
      const blocker = new Client({
        connectionString: requireDatabase().databaseUrl,
      })
      await blocker.connect()
      await prisma.$executeRawUnsafe(`
      CREATE FUNCTION block_review_resolution_for_test() RETURNS trigger AS $$
      BEGIN
        IF OLD.status IN ('PENDING', 'IN_REVIEW') AND NEW.status IN ('RESOLVED', 'REJECTED') THEN
          PERFORM pg_advisory_xact_lock(20502);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER block_review_resolution_for_test
      AFTER UPDATE OF status ON review_cases
      FOR EACH ROW EXECUTE FUNCTION block_review_resolution_for_test();
    `)
      await blocker.query('BEGIN')
      await blocker.query('SELECT pg_advisory_lock(20502)')

      try {
        const action =
          kind === 'resolve'
            ? repository.apply({
                kind,
                reviewCaseId: fixture.reviewCaseId,
                instructorId: fixture.instructorId,
                idempotencyKey: `concurrent-membership-${kind}`,
                request: {
                  expectedVersion: 1,
                  outcome: ReviewOutcome.APPROVED,
                  content: null,
                  reason: null,
                },
              })
            : repository.apply({
                kind,
                reviewCaseId: fixture.reviewCaseId,
                instructorId: fixture.instructorId,
                idempotencyKey: `concurrent-membership-${kind}`,
                request: {
                  expectedVersion: 1,
                  reason: 'Concurrent rejection',
                },
              })
        await waitForBlockedQueryCount(prisma, 1)

        const removal = courses.removeMember({
          courseId: fixture.courseId,
          userId: fixture.instructorId,
          actorUserId: fixture.instructorId,
        })
        const ordering = await Promise.race([
          removal.then(() => 'removal-committed' as const),
          waitForBlockedQueryCount(prisma, 2).then(
            () => 'authorization-lock-held' as const,
          ),
        ])

        await blocker.query('SELECT pg_advisory_unlock(20502)')
        await Promise.all([action, removal])

        expect(ordering).toBe('authorization-lock-held')
      } finally {
        await blocker.query('ROLLBACK')
        await blocker.end()
        await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS block_review_resolution_for_test ON review_cases;
        DROP FUNCTION IF EXISTS block_review_resolution_for_test();
      `)
      }
    },
  )

  it('holds instructor authorization while replaying a terminal action', async () => {
    const fixture = await createCase()
    const prisma = requireDatabase().prisma
    const input = {
      kind: 'resolve' as const,
      reviewCaseId: fixture.reviewCaseId,
      instructorId: fixture.instructorId,
      idempotencyKey: 'membership-locked-replay',
      request: {
        expectedVersion: 1,
        outcome: ReviewOutcome.APPROVED,
        content: null,
        reason: null,
      },
    }
    await repository.apply(input)
    const courses = new PrismaCoursesRepository(
      prisma,
      new CourseAudit(new AuditService(prisma)),
    )
    const blocker = new Client({
      connectionString: requireDatabase().databaseUrl,
    })
    await blocker.connect()
    await blocker.query('BEGIN')
    await blocker.query(
      'LOCK TABLE idempotency_records IN ACCESS EXCLUSIVE MODE',
    )
    let blockerReleased = false

    try {
      const replay = repository.apply(input)
      await waitForBlockedQueryCount(prisma, 1)
      const removal = courses.removeMember({
        courseId: fixture.courseId,
        userId: fixture.instructorId,
        actorUserId: fixture.instructorId,
      })
      await waitForBlockedQueryCount(prisma, 2)

      await blocker.query('ROLLBACK')
      blockerReleased = true
      const [replayResult] = await Promise.all([replay, removal])

      expect(replayResult).toMatchObject({
        kind: 'ok',
        record: { replayed: true },
      })
    } finally {
      if (!blockerReleased) {
        await blocker.query('ROLLBACK')
      }
      await blocker.end()
    }
  })

  it('rejects reuse of an idempotency key with a different fingerprint', async () => {
    const fixture = await createCase()
    const input = {
      kind: 'resolve' as const,
      reviewCaseId: fixture.reviewCaseId,
      instructorId: fixture.instructorId,
      idempotencyKey: 'conflicting-resolution-key',
      request: {
        expectedVersion: 1,
        outcome: ReviewOutcome.EDITED,
        content: 'First correction',
        reason: null,
      },
    }

    await expect(repository.apply(input)).resolves.toMatchObject({ kind: 'ok' })
    await expect(
      repository.apply({
        ...input,
        request: {
          ...input.request,
          content: 'Different correction',
        },
      }),
    ).resolves.toEqual({ kind: 'idempotency_conflict' })
    expect(
      await requireDatabase().prisma.reviewAction.count({
        where: { reviewCaseId: fixture.reviewCaseId },
      }),
    ).toBe(2)
    expect(
      await requireDatabase().prisma.idempotencyRecord.count({
        where: {
          actorUserId: fixture.instructorId,
          operationScope: 'review.resolve',
          key: input.idempotencyKey,
        },
      }),
    ).toBe(1)
  })

  it('does not reject automatic or mixed-trigger cases', async () => {
    for (const triggerTypes of [
      ['POLICY_CHECK_FAILED'],
      ['STUDENT_REQUEST', 'POLICY_CHECK_FAILED'],
    ] as const) {
      const fixture = await createCase([...triggerTypes])
      await expect(
        repository.apply({
          kind: 'reject',
          reviewCaseId: fixture.reviewCaseId,
          instructorId: fixture.instructorId,
          idempotencyKey: `reject-${triggerTypes.join('-')}`,
          request: { expectedVersion: 1, reason: 'Cannot reject this case' },
        }),
      ).resolves.toEqual({ kind: 'automatic_not_rejectable' })
    }
  })

  it('rolls back review inbox creation when the terminal transaction fails', async () => {
    const fixture = await createCase()

    await expect(
      repository.apply({
        kind: 'resolve',
        reviewCaseId: fixture.reviewCaseId,
        instructorId: fixture.instructorId,
        idempotencyKey: 'x'.repeat(201),
        request: {
          expectedVersion: 1,
          outcome: ReviewOutcome.APPROVED,
          content: null,
          reason: null,
        },
      }),
    ).rejects.toBeDefined()
    expect(
      await requireDatabase().prisma.reviewInboxItem.count({
        where: { reviewCaseId: fixture.reviewCaseId },
      }),
    ).toBe(0)
    expect(
      await requireDatabase().prisma.reviewCase.findUniqueOrThrow({
        where: { id: fixture.reviewCaseId },
        select: { status: true, version: true },
      }),
    ).toEqual({ status: 'PENDING', version: 1 })
    expect(
      await requireDatabase().prisma.reviewAction.count({
        where: { reviewCaseId: fixture.reviewCaseId },
      }),
    ).toBe(1)
  })

  async function createCase(
    triggerTypes: ('STUDENT_REQUEST' | 'POLICY_CHECK_FAILED')[] = [
      'STUDENT_REQUEST',
    ],
  ) {
    const prisma = requireDatabase().prisma
    const instructorId = await createInstructor()
    const studentId = randomUUID()
    const courseId = randomUUID()
    const sessionId = randomUUID()
    const studentMessageId = randomUUID()
    const assistantMessageId = randomUUID()
    await prisma.user.create({
      data: {
        id: studentId,
        email: `${studentId}@review-action.test`,
        displayName: 'Student',
        role: 'STUDENT',
        passwordHash: 'hash',
      },
    })
    await prisma.course.create({
      data: {
        id: courseId,
        code: `ACT-${courseId.slice(0, 8)}`,
        title: 'Review action course',
        createdById: instructorId,
      },
    })
    await prisma.courseMembership.createMany({
      data: [
        { courseId, userId: instructorId, role: 'INSTRUCTOR' },
        { courseId, userId: studentId, role: 'STUDENT' },
      ],
    })
    await prisma.chatSession.create({
      data: {
        id: sessionId,
        courseId,
        studentId,
        title: 'Review action session',
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
          content: 'Original immutable answer',
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      ],
    })
    const reviewCase = await prisma.reviewCase.create({
      data: {
        targetMessageId: assistantMessageId,
        courseId,
        requestedByUserId: triggerTypes.includes('STUDENT_REQUEST')
          ? studentId
          : null,
        triggers: {
          create: triggerTypes.map((type) => ({
            type,
            actorUserId: type === 'STUDENT_REQUEST' ? studentId : null,
            studentFlagReason: type === 'STUDENT_REQUEST' ? 'OTHER' : null,
            sourceEventKey:
              type === 'STUDENT_REQUEST' ? null : `event-${randomUUID()}`,
          })),
        },
        actions: {
          create: {
            actorUserId: triggerTypes.includes('STUDENT_REQUEST')
              ? studentId
              : null,
            actionType: 'CREATED',
            toStatus: 'PENDING',
            caseVersion: 1,
            operationId: randomUUID(),
          },
        },
      },
    })
    return {
      reviewCaseId: reviewCase.id,
      courseId,
      instructorId,
      studentId,
      assistantMessageId,
    }
  }

  async function createInstructor() {
    const id = randomUUID()
    await requireDatabase().prisma.user.create({
      data: {
        id,
        email: `${id}@review-action.test`,
        displayName: 'Instructor',
        role: 'INSTRUCTOR',
        passwordHash: 'hash',
      },
    })
    return id
  }

  function requireDatabase() {
    if (database === undefined) throw new Error('Database is not initialized')
    return database
  }
})

async function waitForBlockedQueryCount(
  prisma: DisposableDatabase['prisma'],
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
