import { describe, expect, it, vi } from 'vitest'

import type { ApiError } from '@/features/auth/session/authenticated-api-client'

import {
  getStudentReviewInbox,
  getUnreadStudentReviewInboxCount,
  markStudentReviewInboxItemRead,
} from './student-review-inbox.api'

const inboxItemId = '10000000-0000-4000-8000-000000000001'
const inboxItem = {
  id: inboxItemId,
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

describe('Student review inbox API', () => {
  it('loads and validates a cursor-paginated review inbox', async () => {
    const cursor = '60000000-0000-4000-8000-000000000001'
    const response = { items: [inboxItem], nextCursor: cursor }
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input))
        expect(url.pathname).toBe('/api/v1/reviews/inbox')
        expect(url.searchParams.get('cursor')).toBe(cursor)
        expect(url.searchParams.get('limit')).toBe('10')
        expect(init?.method).toBe('GET')
        return Response.json(response)
      },
    )

    await expect(
      getStudentReviewInbox({
        cursor,
        limit: 10,
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(response)
  })

  it('loads the unread review inbox count', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          'http://localhost:4000/api/v1/reviews/inbox/unread-count',
        )
        expect(init?.method).toBe('GET')
        return Response.json({ unreadCount: 2 })
      },
    )

    await expect(
      getUnreadStudentReviewInboxCount({ fetchImpl: fetchMock }),
    ).resolves.toEqual({ unreadCount: 2 })
  })

  it('marks a review inbox item read and validates the response', async () => {
    const readInboxItem = {
      ...inboxItem,
      status: 'READ',
      readAt: '2026-07-31T10:05:00.000Z',
    } as const
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/reviews/inbox/${inboxItemId}/read`,
        )
        expect(init?.method).toBe('POST')
        return Response.json(readInboxItem)
      },
    )

    await expect(
      markStudentReviewInboxItemRead(inboxItemId, { fetchImpl: fetchMock }),
    ).resolves.toEqual(readInboxItem)
  })

  it('maps API failures to the shared ApiError type', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          code: 'REVIEW_INBOX_ITEM_NOT_FOUND',
          message: 'Review inbox item not found',
        },
        { status: 404 },
      ),
    )

    await expect(
      markStudentReviewInboxItemRead(inboxItemId, { fetchImpl: fetchMock }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({
        name: 'ApiError',
        status: 404,
        code: 'REVIEW_INBOX_ITEM_NOT_FOUND',
      }),
    )
  })
})
