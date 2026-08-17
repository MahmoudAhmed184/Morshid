import { describe, expect, it } from 'vitest'

import {
  studentReviewInboxItemSchema,
  studentReviewInboxListSchema,
  unreadStudentReviewInboxCountSchema,
} from './student-review-inbox.schema'

const inboxItem = {
  id: '10000000-0000-4000-8000-000000000001',
  reviewCaseId: '20000000-0000-4000-8000-000000000001',
  courseId: '30000000-0000-4000-8000-000000000001',
  sessionId: '40000000-0000-4000-8000-000000000001',
  messageId: '50000000-0000-4000-8000-000000000001',
  type: 'REVIEW_RESOLVED',
  status: 'UNREAD',
  title: 'Instructor review completed',
  body: 'Your review request has been resolved.',
  createdAt: '2026-07-31T10:00:00.000Z',
  readAt: null,
} as const

describe('Student review inbox schemas', () => {
  it('accepts the strict item, list, and unread count contracts', () => {
    expect(studentReviewInboxItemSchema.parse(inboxItem)).toEqual(inboxItem)
    expect(
      studentReviewInboxListSchema.parse({
        items: [inboxItem],
        nextCursor: null,
      }),
    ).toEqual({ items: [inboxItem], nextCursor: null })
    expect(
      unreadStudentReviewInboxCountSchema.parse({ unreadCount: 3 }),
    ).toEqual({ unreadCount: 3 })
  })

  it.each([
    { ...inboxItem, instructorId: 'private' },
    { ...inboxItem, type: 'UNKNOWN_TYPE' },
    { ...inboxItem, status: 'UNKNOWN_STATUS' },
  ])('rejects invalid or private review inbox fields', (value) => {
    expect(() => studentReviewInboxItemSchema.parse(value)).toThrow()
  })

  it('rejects unknown list and unread-count fields', () => {
    expect(() =>
      studentReviewInboxListSchema.parse({
        items: [inboxItem],
        nextCursor: null,
        total: 1,
      }),
    ).toThrow()
    expect(() =>
      unreadStudentReviewInboxCountSchema.parse({
        unreadCount: 1,
        userId: 'private',
      }),
    ).toThrow()
  })
})
