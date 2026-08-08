import {
  MessageRole,
  ReviewStatus,
  ReviewTriggerType,
  StudentFlagReason,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import { InstructorReviewDetailService } from './instructor-review-detail.service'

describe('InstructorReviewDetailService', () => {
  const user: AuthenticatedRequestUser = {
    id: 'instructor-1',
    email: 'instructor@example.test',
    displayName: 'Instructor',
    role: UserRole.INSTRUCTOR,
    status: UserStatus.ACTIVE,
  }
  const findAuthorized = jest.fn()
  const service = new InstructorReviewDetailService({ findAuthorized })

  beforeEach(() => jest.clearAllMocks())

  it.each(['unauthorized', 'guessed', 'nonexistent', 'deleted'])(
    'returns the same concealed error for a %s review',
    async () => {
      findAuthorized.mockResolvedValue(null)
      await expect(service.get(user, 'review-x')).rejects.toMatchObject({
        status: 404,
        response: { code: 'REVIEW_NOT_FOUND' },
      })
    },
  )

  it('returns only the allowlisted fields for an authorized Instructor', async () => {
    findAuthorized.mockResolvedValue(record())

    const result = await service.get(user, 'review-1')

    expect(findAuthorized).toHaveBeenCalledWith(user.id, 'review-1')
    expect(Object.keys(result)).toEqual([
      'reviewCaseId',
      'status',
      'version',
      'canReject',
      'trigger',
      'studentFlagReason',
      'createdAt',
      'requestedAt',
      'studentNote',
      'course',
      'student',
      'flaggedExchange',
      'assistantResponse',
      'previousExchange',
      'followingExchange',
      'actions',
      'reviewSummary',
    ])
    expect(JSON.stringify(result)).not.toMatch(
      /unrelated|email|evidence|retrieval|embedding|vector|internal/,
    )
    expect(result.assistantResponse.citations[0]?.snippets[0]).toEqual({
      chunkNumber: 3,
      excerpt: 'bounded source excerpt',
    })
  })

  function record() {
    const createdAt = new Date('2026-07-29T10:00:00.000Z')
    return {
      id: 'review-1',
      status: ReviewStatus.PENDING,
      version: 3,
      canReject: true,
      outcome: null,
      resolvedAt: null,
      createdAt,
      trigger: {
        type: ReviewTriggerType.STUDENT_REQUEST,
        createdAt,
      },
      studentFlagReason: StudentFlagReason.CONFUSING,
      studentNote: 'Please check',
      course: { id: 'course-1', code: 'C1', title: 'Course One' },
      student: { id: 'student-1', displayName: 'Safe Student' },
      flaggedExchange: message(MessageRole.STUDENT, 'flagged question'),
      assistantResponse: {
        ...message(MessageRole.ASSISTANT, 'flagged answer'),
        citations: [
          {
            order: 1,
            materialId: 'material-1',
            materialTitle: 'Safe source',
            snippets: [
              { chunkNumber: 3, content: ' bounded  source excerpt ' },
            ],
          },
        ],
      },
      previousMessages: [
        message(MessageRole.STUDENT, 'previous question'),
        message(MessageRole.ASSISTANT, 'previous answer'),
      ],
      followingMessages: [],
      actions: [],
      notificationCount: 0,
    }
  }

  function message(role: MessageRole, content: string) {
    return { role, content, createdAt: new Date('2026-07-29T09:00:00.000Z') }
  }
})
