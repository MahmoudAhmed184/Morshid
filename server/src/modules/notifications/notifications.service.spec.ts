import {
  NotificationStatus,
  NotificationType,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import { NotificationsService } from './notifications.service'

describe('NotificationsService', () => {
  const user: AuthenticatedRequestUser = {
    id: 'student-1',
    email: 'student@example.test',
    displayName: 'Student',
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
  }
  const list = jest.fn()
  const countUnread = jest.fn()
  const markRead = jest.fn()
  const service = new NotificationsService({ list, countUnread, markRead })

  beforeEach(() => jest.clearAllMocks())

  it('returns only safe Student-facing notification fields', async () => {
    list.mockResolvedValue({ records: [record()], nextCursor: null })

    const result = await service.list(user, { limit: 25 })

    expect(list).toHaveBeenCalledWith(user.id, undefined, 25)
    expect(result.items[0]).toEqual({
      id: 'notification-1',
      reviewCaseId: 'case-1',
      messageId: 'message-1',
      sessionId: 'session-1',
      type: NotificationType.REVIEW_RESOLVED,
      status: NotificationStatus.UNREAD,
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

  it('conceals a missing or foreign notification', async () => {
    markRead.mockResolvedValue(null)
    await expect(
      service.markRead(user, 'notification-x'),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'NOTIFICATION_NOT_FOUND' },
    })
  })

  function record() {
    return {
      id: 'notification-1',
      reviewCaseId: 'case-1',
      messageId: 'message-1',
      sessionId: 'session-1',
      type: NotificationType.REVIEW_RESOLVED,
      status: NotificationStatus.UNREAD,
      createdAt: new Date('2026-07-31T00:00:00.000Z'),
      readAt: null,
    }
  }
})
