import { HttpException } from '@nestjs/common'
import { instanceToPlain, plainToInstance } from 'class-transformer'

import { UserRole, UserStatus } from '../../generated/prisma/client'
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
    repository = { create: jest.fn() }
    creator = new ReviewCaseCreator(repository)
  })

  it('passes only the authenticated Student and message to persistence', async () => {
    repository.create.mockResolvedValue(ok(false))

    const response = await creator.createManual(
      messageId,
      { note: 'Needs checking' },
      'request-1',
      user,
    )

    expect(repository.create.mock.calls[0]?.[0]).toEqual({
      kind: 'manual',
      messageId,
      actorUserId: user.id,
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
        hasNotification: false,
      },
    })
    expect(response).not.toHaveProperty('courseId')
    expect(response).not.toHaveProperty('evidence')
  })

  it('returns the same safe summary for duplicate creation', async () => {
    repository.create.mockResolvedValue(ok(true))

    const response = await creator.createManual(
      messageId,
      { note: null },
      'request-2',
      user,
    )

    expect(response.replayed).toBe(true)
    expect(response.caseId).toBe(caseId)
  })

  it('provides automatic safety with the shared contract without exposing persistence records', async () => {
    repository.create.mockResolvedValue({
      kind: 'ok',
      record: {
        ...ok(false).record,
        trigger: 'POLICY_CHECK_FAILED',
      },
    })

    const result = await creator.createAutomatic({
      messageId,
      trigger: 'POLICY_CHECK_FAILED',
      sourceEventKey: 'detector-event-1',
      evidence: {
        summary: '  confidence threshold was not met  ',
        facts: [{ code: 'confidence', value: 0.3 }],
      },
      detectorMetadata: { detectorVersion: 'v1' },
    })

    expect(repository.create.mock.calls[0]?.[0]).toEqual({
      kind: 'automatic',
      messageId,
      trigger: 'POLICY_CHECK_FAILED',
      sourceEventKey: 'detector-event-1',
      evidence: {
        summary: 'confidence threshold was not met',
        sources: [],
        facts: [{ code: 'confidence', value: 0.3 }],
      },
      detectorMetadata: { detectorVersion: 'v1' },
      requestContext: undefined,
    })
    expect(result).toEqual({
      caseId,
      messageId,
      status: 'PENDING',
      replayed: false,
    })
  })

  it('rejects an automatic evidence contribution outside its bounds', async () => {
    await expect(
      creator.createAutomatic({
        messageId,
        trigger: 'POLICY_CHECK_FAILED',
        sourceEventKey: 'detector-event-2',
        evidence: { summary: 'x'.repeat(1_001) },
      }),
    ).rejects.toThrow('summary must contain between 1 and 1000 characters')
    expect(repository.create.mock.calls).toHaveLength(0)
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
            hasNotification: false,
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
        hasNotification: false,
        reviewCaseId: caseId,
      },
    })
  })

  it('rejects reuse of an idempotency key with a different fingerprint', async () => {
    repository.create.mockResolvedValue({ kind: 'idempotency_conflict' })

    await expect(
      creator.createManual(messageId, { note: null }, 'reused-key', user),
    ).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_KEY_REUSED' },
      status: 409,
    })
  })

  it('maps exhausted manual quota to a non-leaking 429 response', async () => {
    repository.create.mockResolvedValue({ kind: 'quota_exceeded' })

    await expect(
      creator.createManual(messageId, { note: null }, 'quota-key', user),
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
        await creator.createManual(messageId, { note: null }, key, user)
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
      creator.createManual(messageId, { note: null }, 'request-3', user),
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
    expect(createReviewRequestSchema.parse({ note: '  check this  ' })).toEqual(
      {
        note: 'check this',
      },
    )
    expect(createReviewRequestSchema.parse({ note: '   ' })).toEqual({
      note: null,
    })
    expect(createReviewRequestSchema.parse({})).toEqual({ note: null })
  })

  it('rejects notes over 200 characters and unknown fields', () => {
    expect(() =>
      createReviewRequestSchema.parse({ note: 'x'.repeat(201) }),
    ).toThrow()
    expect(() =>
      createReviewRequestSchema.parse({ note: null, courseId: 'untrusted' }),
    ).toThrow()
  })
})
