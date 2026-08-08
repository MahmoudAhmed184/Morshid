import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from '@/features/notifications/hooks/use-notifications'
import type { Notification } from '@/features/notifications/schemas/notification.schema'
import { resolveNotificationCourseId } from '@/features/notifications/utils/resolve-notification-course'
import { useStudentCourseContext } from '@/features/student/components/student-course-context'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'

import { StudentNotificationBell } from './student-notification-bell'

const navigateMock = vi.hoisted(() => vi.fn())
const destinationApiMocks = vi.hoisted(() => ({
  getStudentReviewDetail: vi.fn(),
  getStudentSession: vi.fn(),
  getStudentSessionMessages: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))
vi.mock('@/features/notifications/hooks/use-notifications')
vi.mock('@/features/notifications/utils/resolve-notification-course')
vi.mock('@/features/student/components/student-course-context')
vi.mock('@/features/student/data/student-reviews.api', () => ({
  getStudentReviewDetail: destinationApiMocks.getStudentReviewDetail,
}))
vi.mock('@/features/student/data/student-sessions.api', () => ({
  getStudentSession: destinationApiMocks.getStudentSession,
  getStudentSessionMessages: destinationApiMocks.getStudentSessionMessages,
}))

const useNotificationsMock = vi.mocked(useNotifications)
const useUnreadNotificationCountMock = vi.mocked(useUnreadNotificationCount)
const useMarkNotificationReadMock = vi.mocked(useMarkNotificationRead)
const resolveNotificationCourseIdMock = vi.mocked(resolveNotificationCourseId)
const useStudentCourseContextMock = vi.mocked(useStudentCourseContext)
const markReadMock = vi.fn()
const fetchNextPageMock = vi.fn()
const primaryCourse: StudentCourse = {
  id: '50000000-0000-4000-8000-000000000001',
  code: 'C1',
  title: 'Course One',
  membershipRole: 'STUDENT',
}
const notificationCourse: StudentCourse = {
  id: '50000000-0000-4000-8000-000000000002',
  code: 'C2',
  title: 'Course Two',
  membershipRole: 'STUDENT',
}
const notification: Notification = {
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
}

describe('StudentNotificationBell', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    navigateMock.mockResolvedValue(undefined)
    destinationApiMocks.getStudentReviewDetail.mockResolvedValue({})
    destinationApiMocks.getStudentSession.mockResolvedValue({})
    destinationApiMocks.getStudentSessionMessages.mockResolvedValue({})
    markReadMock.mockResolvedValue({ ...notification, status: 'READ' })
    resolveNotificationCourseIdMock.mockResolvedValue(notificationCourse.id)
    useStudentCourseContextMock.mockReturnValue({
      courses: [primaryCourse, notificationCourse],
      activeCourse: primaryCourse,
    })
    useUnreadNotificationCountMock.mockReturnValue(
      unreadCountResult({ unreadCount: 0 }),
    )
    useNotificationsMock.mockReturnValue(notificationsResult([notification]))
    useMarkNotificationReadMock.mockReturnValue(markReadResult())
  })

  afterEach(cleanup)

  it('renders an accessible notification button and consumes the hooks', () => {
    render(<StudentNotificationBell />)

    expect(screen.getByRole('button', { name: 'Notifications' })).toBeVisible()
    expect(useUnreadNotificationCountMock).toHaveBeenCalledOnce()
    expect(useNotificationsMock).toHaveBeenCalledOnce()
    expect(useMarkNotificationReadMock).toHaveBeenCalledOnce()
  })

  it('shows the unread count badge only when the count is positive', () => {
    useUnreadNotificationCountMock.mockReturnValue(
      unreadCountResult({ unreadCount: 3 }),
    )
    const { rerender } = render(<StudentNotificationBell />)

    expect(screen.getByText('3')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Notifications, 3 unread' }),
    ).toBeVisible()

    useUnreadNotificationCountMock.mockReturnValue(
      unreadCountResult({ unreadCount: 0 }),
    )
    rerender(<StudentNotificationBell />)
    expect(screen.queryByText('0')).toBeNull()
  })

  it('opens the dropdown and renders safe notification fields and unread state', async () => {
    const user = userEvent.setup()
    render(<StudentNotificationBell />)
    await openDropdown(user)

    expect(screen.getByText(notification.title)).toBeVisible()
    expect(screen.getByText(notification.body)).toBeVisible()
    expect(
      document.querySelector(`time[datetime="${notification.createdAt}"]`),
    ).not.toBeNull()
    expect(screen.getByText('Unread notification.')).toHaveClass('sr-only')
  })

  it('marks an unread notification read and navigates to its chat message', async () => {
    const user = userEvent.setup()
    render(<StudentNotificationBell />)
    await openDropdown(user)

    await user.click(screen.getByText(notification.title))

    expect(markReadMock).toHaveBeenCalledWith(notification.id)
    expect(resolveNotificationCourseIdMock).toHaveBeenCalledWith({
      courses: [primaryCourse, notificationCourse],
      sessionId: notification.sessionId,
    })
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/chat',
      search: {
        courseId: notificationCourse.id,
        sessionId: notification.sessionId,
      },
      hash: `message-${notification.messageId}`,
    })
  })

  it.each([
    { sessionId: null, messageId: notification.messageId },
    { sessionId: notification.sessionId, messageId: null },
  ])(
    'does not create a chat URL when related identifiers are incomplete',
    async (identifiers) => {
      const user = userEvent.setup()
      const incomplete = { ...notification, ...identifiers }
      useNotificationsMock.mockReturnValue(notificationsResult([incomplete]))
      render(<StudentNotificationBell />)
      await openDropdown(user)

      await user.click(screen.getByText(incomplete.title))

      expect(markReadMock).toHaveBeenCalledWith(incomplete.id)
      expect(resolveNotificationCourseIdMock).not.toHaveBeenCalled()
      expect(navigateMock).not.toHaveBeenCalled()
    },
  )

  it('does not mark an already-read notification again', async () => {
    const user = userEvent.setup()
    const readNotification = { ...notification, status: 'READ' as const }
    useNotificationsMock.mockReturnValue(
      notificationsResult([readNotification]),
    )
    render(<StudentNotificationBell />)
    await openDropdown(user)

    await user.click(screen.getByText(readNotification.title))

    expect(markReadMock).not.toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledOnce()
  })

  it('keeps the notification unread when destination content cannot load', async () => {
    const user = userEvent.setup()
    destinationApiMocks.getStudentReviewDetail.mockRejectedValue(
      new Error('review unavailable'),
    )
    render(<StudentNotificationBell />)
    await openDropdown(user)

    await user.click(screen.getByText(notification.title))

    expect(navigateMock).not.toHaveBeenCalled()
    expect(markReadMock).not.toHaveBeenCalled()
  })

  it('continues navigation when mark-read fails', async () => {
    const user = userEvent.setup()
    markReadMock.mockRejectedValue(new Error('Mark read failed'))
    render(<StudentNotificationBell />)
    await openDropdown(user)

    await user.click(screen.getByText(notification.title))

    await waitFor(() => expect(markReadMock).toHaveBeenCalledOnce())
    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({ courseId: notificationCourse.id }),
      }),
    )
  })

  it('guards duplicate notification activation synchronously', async () => {
    const user = userEvent.setup()
    let finishMarkRead: (() => void) | undefined
    markReadMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishMarkRead = () => resolve({ ...notification, status: 'READ' })
        }),
    )
    render(<StudentNotificationBell />)
    await openDropdown(user)
    const item = screen.getByRole('menuitem', {
      name: /Instructor review completed/,
    })

    fireEvent.click(item)
    fireEvent.click(item)

    await waitFor(() => expect(markReadMock).toHaveBeenCalledOnce())
    finishMarkRead?.()
    await waitFor(() => expect(navigateMock).toHaveBeenCalledOnce())
  })

  it('supports keyboard notification selection', async () => {
    const user = userEvent.setup()
    render(<StudentNotificationBell />)
    await openDropdown(user)
    const item = screen.getByRole('menuitem', {
      name: /Unread notification.*Instructor review completed/,
    })
    item.focus()

    await user.keyboard('{Enter}')

    expect(markReadMock).toHaveBeenCalledWith(notification.id)
    expect(navigateMock).toHaveBeenCalledOnce()
  })

  it('renders the empty state', async () => {
    const user = userEvent.setup()
    useNotificationsMock.mockReturnValue(notificationsResult([]))
    render(<StudentNotificationBell />)
    await openDropdown(user)

    expect(screen.getByText('No notifications yet.')).toBeVisible()
  })

  it('renders a safe error state', async () => {
    const user = userEvent.setup()
    useNotificationsMock.mockReturnValue(
      notificationsResult([], { isError: true }),
    )
    render(<StudentNotificationBell />)
    await openDropdown(user)

    expect(screen.getByText('Notifications could not be loaded.')).toBeVisible()
  })

  it('renders a non-blocking loading state', async () => {
    const user = userEvent.setup()
    useNotificationsMock.mockReturnValue(
      notificationsResult([], { isPending: true }),
    )
    render(<StudentNotificationBell />)
    await openDropdown(user)

    expect(screen.getByText('Loading notifications…')).toBeVisible()
  })

  it('loads the next notification page with keyboard activation', async () => {
    const user = userEvent.setup()
    useNotificationsMock.mockReturnValue(
      notificationsResult([notification], { hasNextPage: true }),
    )
    render(<StudentNotificationBell />)
    await openDropdown(user)

    const loadMoreItem = screen.getByRole('menuitem', { name: 'Load more' })
    loadMoreItem.focus()
    await user.keyboard('{Enter}')

    expect(fetchNextPageMock).toHaveBeenCalledOnce()
    expect(screen.getByRole('menu', { name: 'Notifications' })).toBeVisible()
  })

  it('shows and disables the loading-more control', async () => {
    const user = userEvent.setup()
    useNotificationsMock.mockReturnValue(
      notificationsResult([notification], {
        hasNextPage: true,
        isFetchingNextPage: true,
      }),
    )
    render(<StudentNotificationBell />)
    await openDropdown(user)

    expect(
      screen.getByRole('menuitem', { name: 'Loading more…' }),
    ).toHaveAttribute('aria-disabled', 'true')
  })
})

async function openDropdown(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Notifications/ }))
  await screen.findByRole('menu', { name: 'Notifications' })
}

function unreadCountResult(
  data: { unreadCount: number } | undefined,
  overrides: { isPending?: boolean; isError?: boolean } = {},
) {
  return {
    data,
    isPending: overrides.isPending ?? false,
    isError: overrides.isError ?? false,
  } as ReturnType<typeof useUnreadNotificationCount>
}

function notificationsResult(
  items: Notification[],
  overrides: {
    hasNextPage?: boolean
    isError?: boolean
    isFetchingNextPage?: boolean
    isPending?: boolean
  } = {},
) {
  return {
    data: { pages: [{ items, nextCursor: null }], pageParams: [null] },
    fetchNextPage: fetchNextPageMock,
    hasNextPage: overrides.hasNextPage ?? false,
    isError: overrides.isError ?? false,
    isFetchingNextPage: overrides.isFetchingNextPage ?? false,
    isPending: overrides.isPending ?? false,
  } as unknown as ReturnType<typeof useNotifications>
}

function markReadResult() {
  return {
    isPending: false,
    mutateAsync: markReadMock,
    variables: undefined,
  } as unknown as ReturnType<typeof useMarkNotificationRead>
}
