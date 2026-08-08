import {
  CourseMembershipRole,
  MessageRole,
  ReviewStatus,
  ReviewTriggerType,
} from '../../generated/prisma/client'
import type { PrismaService } from '../prisma/prisma.service'
import { PrismaInstructorReviewDetailRepository } from './instructor-review-detail.repository'
import { reviewEvidenceContentHash } from './review-evidence-integrity'

describe('PrismaInstructorReviewDetailRepository', () => {
  const findReview = jest.fn()
  const repository = new PrismaInstructorReviewDetailRepository({
    reviewCase: { findFirst: findReview },
  } as unknown as PrismaService)

  beforeEach(() => jest.clearAllMocks())

  it('authorizes through an active Instructor assignment and conceals deleted sessions', async () => {
    findReview.mockResolvedValue(null)

    await expect(
      repository.findAuthorized('instructor-1', 'review-1'),
    ).resolves.toBeNull()

    expect(findReview).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'review-1',
          course: {
            memberships: {
              some: {
                userId: 'instructor-1',
                role: CourseMembershipRole.INSTRUCTOR,
                removedAt: null,
              },
            },
          },
          targetMessage: { session: { deletedAt: null } },
        },
      }),
    )
  })

  it('returns only the immutable context captured in the evidence snapshot', async () => {
    findReview.mockResolvedValue(reviewRecord())

    const result = await repository.findAuthorized('instructor-1', 'review-1')

    expect(result?.previousMessages.map(({ content }) => content)).toEqual([
      'previous question',
      'previous answer',
    ])
    expect(result?.followingMessages.map(({ content }) => content)).toEqual([
      'following question',
      'following answer',
    ])
  })

  it('conceals a snapshot whose integrity hash does not match', async () => {
    const record = reviewRecord()
    findReview.mockResolvedValue({
      ...record,
      evidence: { ...record.evidence, contentHash: 'tampered' },
    })

    await expect(
      repository.findAuthorized('instructor-1', 'review-1'),
    ).resolves.toBeNull()
  })

  it.each([
    {
      label: 'manual active',
      status: ReviewStatus.PENDING,
      triggers: [ReviewTriggerType.STUDENT_REQUEST],
      expected: true,
    },
    {
      label: 'automatic',
      status: ReviewStatus.PENDING,
      triggers: [ReviewTriggerType.CITATION_MISSING],
      expected: false,
    },
    {
      label: 'mixed',
      status: ReviewStatus.IN_REVIEW,
      triggers: [
        ReviewTriggerType.STUDENT_REQUEST,
        ReviewTriggerType.SOURCE_CONFLICT,
      ],
      expected: false,
    },
    {
      label: 'terminal manual',
      status: ReviewStatus.RESOLVED,
      triggers: [ReviewTriggerType.STUDENT_REQUEST],
      expected: false,
    },
  ])(
    'derives canReject=false only outside $label eligibility',
    async ({ status, triggers, expected }) => {
      findReview.mockResolvedValue(
        reviewRecord({
          status,
          triggers: triggers.map((type) => ({
            type,
            studentFlagReason: null,
            reason: null,
            createdAt: new Date('2026-07-29T10:00:01.000Z'),
          })),
        }),
      )
      await expect(
        repository.findAuthorized('instructor-1', 'review-1'),
      ).resolves.toMatchObject({ version: 3, canReject: expected })
    },
  )

  it('preserves the automatic primary trigger and reads Student request fields separately', async () => {
    findReview.mockResolvedValue(
      reviewRecord({
        triggers: [
          {
            type: ReviewTriggerType.SOURCE_CONFLICT,
            studentFlagReason: null,
            reason: 'automatic reason',
            createdAt: new Date('2026-07-29T10:00:01.000Z'),
          },
          {
            type: ReviewTriggerType.STUDENT_REQUEST,
            studentFlagReason: 'INCORRECT',
            reason: 'student note',
            createdAt: new Date('2026-07-29T10:00:02.000Z'),
          },
        ],
      }),
    )
    await expect(
      repository.findAuthorized('instructor-1', 'review-1'),
    ).resolves.toMatchObject({
      trigger: { type: ReviewTriggerType.SOURCE_CONFLICT },
      studentFlagReason: 'INCORRECT',
      studentNote: 'student note',
    })
  })

  it('selects only bounded review data and never queries live message content', async () => {
    findReview.mockResolvedValue(reviewRecord())

    await repository.findAuthorized('instructor-1', 'review-1')

    const reviewCalls = findReview.mock.calls as unknown as [
      { select: Record<string, unknown> },
    ][]
    const query = reviewCalls[0][0]
    expect(Object.keys(query.select)).toEqual([
      'id',
      'status',
      'version',
      'outcome',
      'resolvedAt',
      'createdAt',
      'course',
      'triggers',
      'targetMessage',
      'evidence',
      'actions',
      '_count',
    ])
    expect(JSON.stringify(query.select.targetMessage)).not.toMatch(
      /content|responseToMessage|citations|retrievals/,
    )
    expect(JSON.stringify(query.select)).not.toMatch(
      /draftContent|publishedContent|email|similarityScore|embedding|vector|storagePath/,
    )
  })

  function reviewRecord(overrides: Record<string, unknown> = {}) {
    const evidence = {
      target: {
        id: 'message-1',
        role: MessageRole.ASSISTANT,
        content: 'flagged answer',
        createdAt: '2026-07-29T09:59:00.000Z',
        completedAt: '2026-07-29T09:59:01.000Z',
      },
      studentPrompt: {
        id: 'message-0',
        content: 'flagged question',
        createdAt: '2026-07-29T09:58:00.000Z',
      },
      context: {
        previousMessages: [
          snapshotMessage(MessageRole.STUDENT, 'previous question'),
          snapshotMessage(MessageRole.ASSISTANT, 'previous answer'),
        ],
        followingMessages: [
          snapshotMessage(MessageRole.STUDENT, 'following question'),
          snapshotMessage(MessageRole.ASSISTANT, 'following answer'),
        ],
      },
      citations: [],
      retrievals: [],
    }
    return {
      id: 'review-1',
      status: ReviewStatus.PENDING,
      version: 3,
      outcome: null,
      resolvedAt: null,
      createdAt: new Date('2026-07-29T10:00:00.000Z'),
      course: { id: 'course-1', code: 'C1', title: 'Course One' },
      triggers: [
        {
          type: ReviewTriggerType.STUDENT_REQUEST,
          studentFlagReason: 'CONFUSING',
          reason: 'Please check',
          createdAt: new Date('2026-07-29T10:00:01.000Z'),
        },
      ],
      targetMessage: {
        session: {
          student: { id: 'student-1', displayName: 'Safe Student' },
        },
      },
      evidence: {
        schemaVersion: 1,
        evidence,
        contentHash: reviewEvidenceContentHash(evidence),
      },
      actions: [],
      _count: { notifications: 0 },
      ...overrides,
    }
  }

  function snapshotMessage(role: MessageRole, content: string) {
    return {
      id: `${role}-${content}`,
      role,
      content,
      createdAt: '2026-07-29T09:00:00.000Z',
    }
  }
})
