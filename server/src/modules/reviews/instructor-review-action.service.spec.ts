import {
  ReviewOutcome,
  ReviewStatus,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import { InstructorReviewActionService } from './instructor-review-action.service'

describe('InstructorReviewActionService', () => {
  const user: AuthenticatedRequestUser = {
    id: 'instructor-1',
    email: 'instructor@example.test',
    displayName: 'Instructor',
    role: UserRole.INSTRUCTOR,
    status: UserStatus.ACTIVE,
  }
  const apply = jest.fn()
  const service = new InstructorReviewActionService({ apply })

  beforeEach(() => apply.mockReset())

  it('passes trusted Instructor identity to an approved resolution', async () => {
    apply.mockResolvedValue({ kind: 'ok', record: record(false) })

    await expect(
      service.resolve(
        'case-1',
        {
          expectedVersion: 1,
          outcome: ReviewOutcome.APPROVED,
          content: null,
          reason: null,
        },
        'key-1',
        user,
      ),
    ).resolves.toMatchObject({
      reviewCaseId: 'case-1',
      status: ReviewStatus.RESOLVED,
      replayed: false,
    })
    expect(apply).toHaveBeenCalledWith({
      kind: 'resolve',
      reviewCaseId: 'case-1',
      instructorId: user.id,
      idempotencyKey: 'key-1',
      request: {
        expectedVersion: 1,
        outcome: ReviewOutcome.APPROVED,
        content: null,
        reason: null,
      },
    })
  })

  it.each([
    ['not_found', 404, 'REVIEW_NOT_FOUND'],
    ['stale_version', 409, 'STALE_REVIEW_VERSION'],
    ['invalid_transition', 409, 'INVALID_REVIEW_TRANSITION'],
    ['idempotency_conflict', 409, 'IDEMPOTENCY_KEY_REUSED'],
    ['outcome_content_mismatch', 400, 'OUTCOME_CONTENT_MISMATCH'],
    ['automatic_not_rejectable', 400, 'AUTOMATIC_CASE_NOT_REJECTABLE'],
  ] as const)(
    'maps %s without leaking case details',
    async (kind, status, code) => {
      apply.mockResolvedValue({ kind })

      await expect(
        service.reject(
          'case-1',
          { expectedVersion: 1, reason: 'Not applicable' },
          'key-1',
          user,
        ),
      ).rejects.toMatchObject({ status, response: { code } })
    },
  )

  function record(replayed: boolean) {
    return {
      reviewCaseId: 'case-1',
      status: ReviewStatus.RESOLVED,
      outcome: ReviewOutcome.APPROVED,
      publishedContent: 'Original answer',
      resolutionReason: null,
      version: 2,
      resolvedAt: new Date('2026-07-30T10:00:00.000Z'),
      replayed,
    }
  }
})
