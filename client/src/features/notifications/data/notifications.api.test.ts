import { describe, expect, it, vi } from 'vitest'

import type { ApiError } from '@/features/auth/session/authenticated-api-client'

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
} from './notifications.api'

const notificationId = '10000000-0000-4000-8000-000000000001'
const notification = {
  id: notificationId,
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

describe('Notification API', () => {
  it('loads and validates a cursor-paginated notification list', async () => {
    const cursor = '50000000-0000-4000-8000-000000000001'
    const response = { items: [notification], nextCursor: cursor }
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input))
        expect(url.pathname).toBe('/api/v1/notifications')
        expect(url.searchParams.get('cursor')).toBe(cursor)
        expect(url.searchParams.get('limit')).toBe('10')
        expect(init?.method).toBe('GET')
        return Response.json(response)
      },
    )

    await expect(
      getNotifications({
        cursor,
        limit: 10,
        options: { fetchImpl: fetchMock },
      }),
    ).resolves.toEqual(response)
  })

  it('loads and validates the unread notification count', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          'http://localhost:4000/api/v1/notifications/unread-count',
        )
        expect(init?.method).toBe('GET')
        return Response.json({ unreadCount: 2 })
      },
    )

    await expect(
      getUnreadNotificationCount({ fetchImpl: fetchMock }),
    ).resolves.toEqual({ unreadCount: 2 })
  })

  it('marks a notification read and validates the response', async () => {
    const readNotification = {
      ...notification,
      status: 'READ',
      readAt: '2026-07-31T10:05:00.000Z',
    } as const
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://localhost:4000/api/v1/notifications/${notificationId}/read`,
        )
        expect(init?.method).toBe('POST')
        return Response.json(readNotification)
      },
    )

    await expect(
      markNotificationRead(notificationId, { fetchImpl: fetchMock }),
    ).resolves.toEqual(readNotification)
  })

  it('maps API failures to the shared ApiError type', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found' },
        { status: 404 },
      ),
    )

    await expect(
      markNotificationRead(notificationId, { fetchImpl: fetchMock }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({
        name: 'ApiError',
        status: 404,
        code: 'NOTIFICATION_NOT_FOUND',
      }),
    )
  })
})
