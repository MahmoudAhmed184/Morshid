import { randomUUID } from 'node:crypto'

import { ReviewOutcome } from '../src/generated/prisma/client'
import { PrismaInstructorReviewActionRepository } from '../src/modules/reviews/instructor-review-action.repository'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

describe('Instructor terminal review actions (e2e)', () => {
  let database: DisposableDatabase | undefined
  let repository: PrismaInstructorReviewActionRepository

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue139_actions')
    repository = new PrismaInstructorReviewActionRepository(
      requireDatabase().prisma,
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
      instructorId,
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
