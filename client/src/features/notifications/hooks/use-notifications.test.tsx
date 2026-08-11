import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/features/auth/session/session.schema'
import { useAuthStore } from '@/features/auth/session/session.store'
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
} from '@/features/notifications/data/notifications.api'
import { notificationKeys } from '@/features/notifications/data/notifications.queries'

import {
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from './use-notifications'

vi.mock('@/features/notifications/data/notifications.api')

const getNotificationsMock = vi.mocked(getNotifications)
const getUnreadNotificationCountMock = vi.mocked(getUnreadNotificationCount)
const markNotificationReadMock = vi.mocked(markNotificationRead)
const userId = '60000000-0000-4000-8000-000000000001'
const notificationId = '10000000-0000-4000-8000-000000000001'
const session: AuthSession = {
  user: {
    id: userId,
    email: 'student@morshid.demo',
    displayName: 'Student',
    role: 'STUDENT',
    status: 'ACTIVE',
  },
  tokenType: 'Bearer',
  accessToken: 'access-token',
  accessTokenExpiresAt: '2027-07-31T10:00:00.000Z',
}
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

describe('Notification query hooks', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.getState().setSession(session)
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
  })

  it('loads the notification list for the authenticated user', async () => {
    getNotificationsMock.mockResolvedValue({
      items: [notification],
      nextCursor: null,
    })
    const queryClient = createQueryClient()
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pages[0]?.items).toEqual([notification])
    expect(getNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: null }),
    )
  })

  it('loads the unread count for the authenticated user', async () => {
    getUnreadNotificationCountMock.mockResolvedValue({ unreadCount: 2 })
    const queryClient = createQueryClient()
    const { result } = renderHook(() => useUnreadNotificationCount(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ unreadCount: 2 })
  })

  it('invalidates the notification list and unread count after mark-read', async () => {
    markNotificationReadMock.mockResolvedValue({
      ...notification,
      status: 'READ',
      readAt: '2026-07-31T10:05:00.000Z',
    })
    const queryClient = createQueryClient()
    queryClient.setQueryData(notificationKeys.list(userId), {})
    queryClient.setQueryData(notificationKeys.unreadCount(userId), {
      unreadCount: 1,
    })
    const { result } = renderHook(() => useMarkNotificationRead(), {
      wrapper: createWrapper(queryClient),
    })

    await act(() => result.current.mutateAsync(notificationId))

    expect(markNotificationReadMock).toHaveBeenCalledWith(notificationId)
    expect(
      queryClient.getQueryState(notificationKeys.list(userId))?.isInvalidated,
    ).toBe(true)
    expect(
      queryClient.getQueryState(notificationKeys.unreadCount(userId))
        ?.isInvalidated,
    ).toBe(true)
  })
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}
