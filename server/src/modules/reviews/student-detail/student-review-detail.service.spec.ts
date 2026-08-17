import { UserRole, UserStatus } from '../../identity/identity.roles'
import { ReviewOutcome, ReviewStatus } from '../interface/review-values'
import type { StudentReviewDetailRepository } from './student-review-detail.repository'
import { StudentReviewDetailService } from './student-review-detail.service'

describe('StudentReviewDetailService', () => {
  const user = {
    id: 'student-id',
    email: 'student@example.test',
    displayName: 'Student',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  }
  const findOwned = jest.fn()
  const repository: StudentReviewDetailRepository = {
    findOwned,
  }
  const service = new StudentReviewDetailService(repository)

  beforeEach(() => jest.clearAllMocks())

  it.each([
    [ReviewOutcome.APPROVED, 'Original guidance'],
    [ReviewOutcome.EDITED, 'Edited guidance'],
    [ReviewOutcome.REPLACED, 'Replacement guidance'],
  ])('returns the safe resolved %s outcome', async (outcome, content) => {
    findOwned.mockResolvedValue(record({ outcome, publishedContent: content }))

    await expect(service.get(user, 'review-id')).resolves.toEqual({
      reviewCaseId: 'review-id',
      status: ReviewStatus.RESOLVED,
      outcome,
      publishedContent: content,
      rejectionReason: null,
      requestedAt: '2026-07-30T10:00:00.000Z',
      resolvedAt: '2026-07-31T10:00:00.000Z',
      messageId: 'message-id',
      sessionId: 'session-id',
    })
    expect(findOwned).toHaveBeenCalledWith(user.id, 'review-id')
  })

  it('returns the rejection reason without unrelated fields', async () => {
    findOwned.mockResolvedValue(
      record({
        status: ReviewStatus.REJECTED,
        outcome: ReviewOutcome.REQUEST_REJECTED,
        publishedContent: null,
        resolutionReason: 'Request is not applicable',
      }),
    )

    const result = await service.get(user, 'review-id')
    expect(result).toEqual({
      reviewCaseId: 'review-id',
      status: ReviewStatus.REJECTED,
      outcome: ReviewOutcome.REQUEST_REJECTED,
      publishedContent: null,
      rejectionReason: 'Request is not applicable',
      requestedAt: '2026-07-30T10:00:00.000Z',
      resolvedAt: '2026-07-31T10:00:00.000Z',
      messageId: 'message-id',
      sessionId: 'session-id',
    })
    expect(result).not.toHaveProperty('resolvedByUserId')
    expect(result).not.toHaveProperty('actions')
    expect(result).not.toHaveProperty('evidence')
  })

  it('conceals absent or unowned reviews', async () => {
    findOwned.mockResolvedValue(null)

    await expect(service.get(user, 'guessed-id')).rejects.toMatchObject({
      status: 404,
      response: { code: 'REVIEW_NOT_FOUND' },
    })
  })

  function record(overrides: Record<string, unknown> = {}) {
    return {
      id: 'review-id',
      status: ReviewStatus.RESOLVED,
      outcome: ReviewOutcome.APPROVED,
      publishedContent: 'Original guidance',
      resolutionReason: null,
      resolvedAt: new Date('2026-07-31T10:00:00.000Z'),
      targetMessage: { id: 'message-id', session: { id: 'session-id' } },
      triggers: [{ createdAt: new Date('2026-07-30T10:00:00.000Z') }],
      instructorIdentity: 'must-not-leak',
      evidence: ['must-not-leak'],
      ...overrides,
    }
  }
})
