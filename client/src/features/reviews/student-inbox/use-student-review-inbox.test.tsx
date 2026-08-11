import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/features/auth/session/session.schema'
import { useAuthStore } from '@/features/auth/session/session.store'

import {
  getStudentReviewInbox,
  getUnreadStudentReviewInboxCount,
  markStudentReviewInboxItemRead,
} from './student-review-inbox.api'
import { studentReviewInboxKeys } from './student-review-inbox.queries'
import {
  useMarkStudentReviewInboxItemRead,
  useStudentReviewInbox,
  useUnreadStudentReviewInboxCount,
} from './use-student-review-inbox'

vi.mock('./student-review-inbox.api')

const getInboxMock = vi.mocked(getStudentReviewInbox)
const getUnreadCountMock = vi.mocked(getUnreadStudentReviewInboxCount)
const markReadMock = vi.mocked(markStudentReviewInboxItemRead)
const userId = '60000000-0000-4000-8000-000000000001'
const inboxItemId = '10000000-0000-4000-8000-000000000001'
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

describe('Student review inbox query hooks', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.getState().setSession(session)
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
  })

  it('loads the review inbox for the authenticated Student', async () => {
    getInboxMock.mockResolvedValue({ items: [inboxItem], nextCursor: null })
    const queryClient = createQueryClient()
    const { result } = renderHook(() => useStudentReviewInbox(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pages[0]?.items).toEqual([inboxItem])
    expect(getInboxMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: null }),
    )
  })

  it('loads the unread review inbox count', async () => {
    getUnreadCountMock.mockResolvedValue({ unreadCount: 2 })
    const queryClient = createQueryClient()
    const { result } = renderHook(() => useUnreadStudentReviewInboxCount(), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ unreadCount: 2 })
  })

  it('invalidates the inbox and unread count after mark-read', async () => {
    markReadMock.mockResolvedValue({
      ...inboxItem,
      status: 'READ',
      readAt: '2026-07-31T10:05:00.000Z',
    })
    const queryClient = createQueryClient()
    queryClient.setQueryData(studentReviewInboxKeys.list(userId), {})
    queryClient.setQueryData(studentReviewInboxKeys.unreadCount(userId), {
      unreadCount: 1,
    })
    const { result } = renderHook(() => useMarkStudentReviewInboxItemRead(), {
      wrapper: createWrapper(queryClient),
    })

    await act(() => result.current.mutateAsync(inboxItemId))

    expect(markReadMock).toHaveBeenCalledWith(inboxItemId)
    expect(
      queryClient.getQueryState(studentReviewInboxKeys.list(userId))
        ?.isInvalidated,
    ).toBe(true)
    expect(
      queryClient.getQueryState(studentReviewInboxKeys.unreadCount(userId))
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
