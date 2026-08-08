import { describe, expect, it } from 'vitest'

import {
  notificationListSchema,
  notificationSchema,
  unreadNotificationCountSchema,
} from './notification.schema'

const notification = {
  id: '10000000-0000-4000-8000-000000000001',
  reviewCaseId: '20000000-0000-4000-8000-000000000001',
  messageId: '30000000-0000-4000-8000-000000000001',
  sessionId: '40000000-0000-4000-8000-000000000001',
  type: 'REVIEW_RESOLVED',
  status: 'UNREAD',
  title: 'Instructor review completed',
  body: 'Your review request has been resolved.',
  createdAt: '2026-07-31T10:00:00.000Z',
  readAt: null,
} as const

describe('Notification schemas', () => {
  it('accepts the strict notification, list, and unread count contracts', () => {
    expect(notificationSchema.parse(notification)).toEqual(notification)
    expect(
      notificationListSchema.parse({ items: [notification], nextCursor: null }),
    ).toEqual({ items: [notification], nextCursor: null })
    expect(unreadNotificationCountSchema.parse({ unreadCount: 3 })).toEqual({
      unreadCount: 3,
    })
  })

  it.each([
    { ...notification, instructorId: 'private' },
    { ...notification, type: 'UNKNOWN_TYPE' },
    { ...notification, status: 'UNKNOWN_STATUS' },
  ])('rejects invalid or unknown notification fields', (value) => {
    expect(() => notificationSchema.parse(value)).toThrow()
  })

  it('rejects unknown list and unread-count fields', () => {
    expect(() =>
      notificationListSchema.parse({
        items: [notification],
        nextCursor: null,
        total: 1,
      }),
    ).toThrow()
    expect(() =>
      unreadNotificationCountSchema.parse({
        unreadCount: 1,
        userId: 'private',
      }),
    ).toThrow()
  })
})
