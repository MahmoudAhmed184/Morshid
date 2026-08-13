import { UserRole, UserStatus } from '../identity/identity.roles'
import { HttpException } from '@nestjs/common'
import { instanceToPlain, plainToInstance } from 'class-transformer'

import { StudentFlagReason } from './review-values'
import { ReviewCaseCreator } from './review-case.creator'
import { createReviewRequestSchema } from './review-case.dto'
import { CreateReviewRequestResponseDto } from './review-case.dto'
import type { ReviewCaseRepository } from './review-case.repository'

describe('ReviewCaseCreator', () => {
  const user = {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'student@example.test',
    displayName: 'Student',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  }
  const messageId = '20000000-0000-4000-8000-000000000001'
  const caseId = '30000000-0000-4000-8000-000000000001'
  let repository: jest.Mocked<ReviewCaseRepository>
  let creator: ReviewCaseCreator

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      createAutomaticInTransaction: jest.fn(),
    }
    creator = new ReviewCaseCreator(repository)
  })

  it('passes only the authenticated Student and message to persistence', async () => {
    repository.create.mockResolvedValue(ok(false))

    const response = await creator.createManual(
      messageId,
      { flagReason: StudentFlagReason.INCORRECT, note: 'Needs checking' },
      'request-1',
      user,
    )

    expect(repository.create.mock.calls[0]?.[0]).toEqual({
      kind: 'manual',
      messageId,
      actorUserId: user.id,
      flagReason: StudentFlagReason.INCORRECT,
      reason: 'Needs checking',
      idempotencyKey: 'request-1',
      requestContext: undefined,
    })
    expect(response).toMatchObject({
      caseId,
      messageId,
      replayed: false,
      reviewSummary: {
        reviewCaseId: caseId,
        status: 'PENDING',
        outcome: null,
      },
    })
    expect(response).not.toHaveProperty('courseId')
    expect(response).not.toHaveProperty('evidence')
  })

  it('returns the same safe summary for duplicate creation', async () => {
    repository.create.mockResolvedValue(ok(true))

    const response = await creator.createManual(
      messageId,
      { flagReason: StudentFlagReason.CONFUSING, note: null },
      'request-2',
      user,
    )

    expect(response.replayed).toBe(true)
    expect(response.caseId).toBe(caseId)
  })

  it('serializes only the Student-facing review contract', () => {
    const serialized = instanceToPlain(
      plainToInstance(
        CreateReviewRequestResponseDto,
        {
          caseId,
          messageId,
          status: 'PENDING',
          trigger: 'STUDENT_REQUEST',
          requestedAt: '2026-07-27T12:00:00.000Z',
          replayed: false,
          reviewSummary: {
            status: 'PENDING',
            outcome: null,
            resolvedAt: null,
            reviewCaseId: caseId,
            evidence: { secret: true },
          },
          evidence: { secret: true },
          detectorMetadata: { internal: true },
          assignedInstructorId: user.id,
        },
        { excludeExtraneousValues: true },
      ),
    )

    expect(serialized).toEqual({
      caseId,
      messageId,
      status: 'PENDING',
      trigger: 'STUDENT_REQUEST',
      requestedAt: '2026-07-27T12:00:00.000Z',
      replayed: false,
      reviewSummary: {
        status: 'PENDING',
        outcome: null,
        resolvedAt: null,
        reviewCaseId: caseId,
      },
    })
  })

  it('rejects reuse of an idempotency key with a different fingerprint', async () => {
    repository.create.mockResolvedValue({ kind: 'idempotency_conflict' })

    await expect(
      creator.createManual(
        messageId,
        { flagReason: StudentFlagReason.UNHELPFUL, note: null },
        'reused-key',
        user,
      ),
    ).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_KEY_REUSED' },
      status: 409,
    })
  })

  it('maps exhausted manual quota to a non-leaking 429 response', async () => {
    repository.create.mockResolvedValue({ kind: 'quota_exceeded' })

    await expect(
      creator.createManual(
        messageId,
        { flagReason: StudentFlagReason.COURSE_MISMATCH, note: null },
        'quota-key',
        user,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'MANUAL_REVIEW_QUOTA_EXCEEDED',
        message: 'Daily manual review request limit reached',
      },
      status: 429,
    })
  })

  it('conceals absent and cross-course targets with the same response', async () => {
    repository.create.mockResolvedValue({ kind: 'not_found' })

    for (const key of ['absent-target', 'cross-course-target']) {
      try {
        await creator.createManual(
          messageId,
          { flagReason: StudentFlagReason.TOO_MUCH_ANSWER, note: null },
          key,
          user,
        )
        throw new Error('Expected review creation to fail')
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException)
        expect((error as HttpException).getStatus()).toBe(404)
        expect((error as HttpException).getResponse()).toMatchObject({
          code: 'REVIEW_NOT_FOUND',
        })
      }
    }
  })

  it('rejects a target that is owned but not a completed assistant response', async () => {
    repository.create.mockResolvedValue({ kind: 'not_reviewable' })

    await expect(
      creator.createManual(
        messageId,
        { flagReason: StudentFlagReason.INCORRECT, note: null },
        'request-3',
        user,
      ),
    ).rejects.toMatchObject({
      response: { code: 'TARGET_NOT_REVIEWABLE' },
      status: 400,
    })
  })

  function ok(replayed: boolean) {
    return {
      kind: 'ok' as const,
      record: {
        caseId,
        messageId,
        status: 'PENDING' as const,
        outcome: null,
        resolvedAt: null,
        trigger: 'STUDENT_REQUEST' as const,
        requestedAt: new Date('2026-07-27T12:00:00.000Z'),
        replayed,
      },
    }
  }
})

describe('createReviewRequestSchema', () => {
  it('trims the note and normalizes an empty note to null', () => {
    expect(
      createReviewRequestSchema.parse({
        flagReason: 'INCORRECT',
        note: '  check this  ',
      }),
    ).toEqual({ flagReason: 'INCORRECT', note: 'check this' })
    expect(
      createReviewRequestSchema.parse({
        flagReason: 'CONFUSING',
        note: '   ',
      }),
    ).toEqual({ flagReason: 'CONFUSING', note: null })
    expect(
      createReviewRequestSchema.parse({ flagReason: 'UNHELPFUL' }),
    ).toEqual({ flagReason: 'UNHELPFUL', note: null })
  })

  it('requires a non-empty note for OTHER', () => {
    for (const note of [undefined, null, '   ']) {
      expect(() =>
        createReviewRequestSchema.parse({ flagReason: 'OTHER', note }),
      ).toThrow()
    }
    expect(
      createReviewRequestSchema.parse({
        flagReason: 'OTHER',
        note: '  Another issue  ',
      }),
    ).toEqual({ flagReason: 'OTHER', note: 'Another issue' })
  })

  it('rejects missing or invalid reasons, long notes, and unknown fields', () => {
    expect(() => createReviewRequestSchema.parse({ note: null })).toThrow()
    expect(() =>
      createReviewRequestSchema.parse({ flagReason: 'NOT_A_REASON' }),
    ).toThrow()
    expect(() =>
      createReviewRequestSchema.parse({
        flagReason: 'INCORRECT',
        note: 'x'.repeat(201),
      }),
    ).toThrow()
    expect(() =>
      createReviewRequestSchema.parse({
        flagReason: 'INCORRECT',
        note: null,
        courseId: 'untrusted',
      }),
    ).toThrow()
  })
})
