import {
  CourseMembershipRole,
  MessageRole,
  ReviewStatus,
  ReviewTriggerType,
} from '../../generated/prisma/client'
import type { PrismaService } from '../prisma/prisma.service'
import { PrismaInstructorReviewDetailRepository } from './instructor-review-detail.repository'

describe('PrismaInstructorReviewDetailRepository', () => {
  const findReview = jest.fn()
  const findMessages = jest.fn()
  const transaction = jest.fn((operations: unknown[]) =>
    Promise.all(operations),
  )
  const repository = new PrismaInstructorReviewDetailRepository({
    reviewCase: { findFirst: findReview },
    message: { findMany: findMessages },
    $transaction: transaction,
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
    expect(findMessages).not.toHaveBeenCalled()
  })

  it('fetches at most one previous and one following exchange', async () => {
    findReview.mockResolvedValue(reviewRecord())
    findMessages
      .mockResolvedValueOnce([
        message(MessageRole.ASSISTANT, 'previous answer'),
        message(MessageRole.STUDENT, 'previous question'),
      ])
      .mockResolvedValueOnce([
        message(MessageRole.STUDENT, 'following question'),
        message(MessageRole.ASSISTANT, 'following answer'),
      ])

    const result = await repository.findAuthorized('instructor-1', 'review-1')
    const calls = findMessages.mock.calls as unknown as [
      Record<string, unknown>,
    ][]

    expect(findMessages).toHaveBeenCalledTimes(2)
    expect(calls[0]?.[0]).toMatchObject({
      where: { sessionId: 'session-1', sequence: { lt: 4 } },
      orderBy: { sequence: 'desc' },
      take: 2,
    })
    expect(calls[1]?.[0]).toMatchObject({
      where: { sessionId: 'session-1', sequence: { gt: 5 } },
      orderBy: { sequence: 'asc' },
      take: 2,
    })
    expect(result?.previousMessages.map(({ content }) => content)).toEqual([
      'previous question',
      'previous answer',
    ])
    expect(result?.followingMessages.map(({ content }) => content)).toEqual([
      'following question',
      'following answer',
    ])
  })

  it('selects only bounded review data and never queries unrelated messages', async () => {
    findReview.mockResolvedValue(reviewRecord())
    findMessages.mockResolvedValue([])

    await repository.findAuthorized('instructor-1', 'review-1')

    const reviewCalls = findReview.mock.calls as unknown as [
      { select: Record<string, unknown> },
    ][]
    const query = reviewCalls[0][0]
    expect(Object.keys(query.select)).toEqual([
      'id',
      'status',
      'outcome',
      'resolvedAt',
      'createdAt',
      'course',
      'triggers',
      'targetMessage',
      '_count',
    ])
    expect(JSON.stringify(query.select)).not.toMatch(
      /evidence|actions|draftContent|publishedContent|email|similarityScore|embedding|vector|storagePath/,
    )
    const messageCalls = findMessages.mock.calls as unknown as [
      Record<string, unknown>,
    ][]
    for (const [messageQuery] of messageCalls) {
      expect(messageQuery).toHaveProperty('where.sessionId', 'session-1')
      expect(messageQuery).toHaveProperty('take', 2)
    }
  })

  function reviewRecord() {
    return {
      id: 'review-1',
      status: ReviewStatus.PENDING,
      outcome: null,
      resolvedAt: null,
      createdAt: new Date('2026-07-29T10:00:00.000Z'),
      course: { id: 'course-1', code: 'C1', title: 'Course One' },
      triggers: [
        {
          type: ReviewTriggerType.STUDENT_REQUEST,
          reason: 'Please check',
          createdAt: new Date('2026-07-29T10:00:01.000Z'),
        },
      ],
      targetMessage: {
        sequence: 5,
        role: MessageRole.ASSISTANT,
        content: 'flagged answer',
        createdAt: new Date('2026-07-29T09:59:00.000Z'),
        responseToMessage: {
          sequence: 4,
          role: MessageRole.STUDENT,
          content: 'flagged question',
          createdAt: new Date('2026-07-29T09:58:00.000Z'),
        },
        session: {
          id: 'session-1',
          student: { id: 'student-1', displayName: 'Safe Student' },
        },
        citations: [],
        retrievals: [],
      },
      _count: { notifications: 0 },
    }
  }

  function message(role: MessageRole, content: string) {
    return { role, content, createdAt: new Date('2026-07-29T09:00:00.000Z') }
  }
})
