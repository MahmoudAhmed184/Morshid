import { UserRole, UserStatus } from '../../identity/identity.roles'
import {
  ReviewInboxItemStatus,
  ReviewInboxItemType,
} from '../interface/review-values'
import type { AuthenticatedUser } from '../../identity/identity.types'
import { StudentReviewInboxService } from './student-review-inbox.service'

describe('StudentReviewInboxService', () => {
  const user: AuthenticatedUser = {
    id: 'student-1',
    email: 'student@example.test',
    displayName: 'Student',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
    universityId: 'univ-1',
  }
  const list = jest.fn()
  const countUnread = jest.fn()
  const markRead = jest.fn()
  const service = new StudentReviewInboxService({ list, countUnread, markRead })

  beforeEach(() => jest.clearAllMocks())

  it('returns only safe direct-navigation fields for the Student', async () => {
    list.mockResolvedValue({ records: [record()], nextCursor: null })

    const result = await service.list(user, { limit: 25 })

    expect(list).toHaveBeenCalledWith(user.id, undefined, 25)
    expect(result.items[0]).toEqual({
      id: 'inbox-item-1',
      reviewCaseId: 'case-1',
      courseId: 'course-1',
      messageId: 'message-1',
      sessionId: 'session-1',
      type: ReviewInboxItemType.REVIEW_RESOLVED,
      status: ReviewInboxItemStatus.UNREAD,
      title: 'Instructor review completed',
      body: 'Your review request has been resolved.',
      createdAt: '2026-07-31T00:00:00.000Z',
      readAt: null,
    })
    expect(JSON.stringify(result)).not.toMatch(
      /instructorId|evidence|internalAction|hiddenPrompt|audit/i,
    )
  })

  it('uses the authenticated user for unread count', async () => {
    countUnread.mockResolvedValue(3)
    await expect(service.unreadCount(user)).resolves.toEqual({ unreadCount: 3 })
    expect(countUnread).toHaveBeenCalledWith(user.id)
  })

  it('conceals a missing or foreign inbox item', async () => {
    markRead.mockResolvedValue(null)
    await expect(service.markRead(user, 'inbox-item-x')).rejects.toMatchObject({
      status: 404,
      response: { code: 'REVIEW_INBOX_ITEM_NOT_FOUND' },
    })
  })

  function record() {
    return {
      id: 'inbox-item-1',
      reviewCaseId: 'case-1',
      courseId: 'course-1',
      messageId: 'message-1',
      sessionId: 'session-1',
      type: ReviewInboxItemType.REVIEW_RESOLVED,
      status: ReviewInboxItemStatus.UNREAD,
      createdAt: new Date('2026-07-31T00:00:00.000Z'),
      readAt: null,
    }
  }
})
