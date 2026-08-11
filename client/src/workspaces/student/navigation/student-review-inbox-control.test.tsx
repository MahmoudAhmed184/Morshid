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
  useMarkStudentReviewInboxItemRead,
  useStudentReviewInbox,
  useUnreadStudentReviewInboxCount,
} from './use-student-review-inbox'
import type { StudentReviewInboxItem } from '@/features/reviews/student-inbox/student-review-inbox.schema'
import { StudentReviewInboxControl } from './student-review-inbox-control'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))
vi.mock('./use-student-review-inbox')

const useInboxMock = vi.mocked(useStudentReviewInbox)
const useUnreadCountMock = vi.mocked(useUnreadStudentReviewInboxCount)
const useMarkReadMock = vi.mocked(useMarkStudentReviewInboxItemRead)
const markReadMock = vi.fn()
const fetchNextPageMock = vi.fn()
const inboxItem: StudentReviewInboxItem = {
  id: '10000000-0000-4000-8000-000000000001',
  reviewCaseId: '20000000-0000-4000-8000-000000000001',
  courseId: '30000000-0000-4000-8000-000000000001',
  messageId: '40000000-0000-4000-8000-000000000001',
  sessionId: '50000000-0000-4000-8000-000000000001',
  type: 'REVIEW_RESOLVED',
  status: 'UNREAD',
  title: 'Instructor review completed',
  body: 'Your review request has been resolved.',
  createdAt: '2026-07-31T10:00:00.000Z',
  readAt: null,
}

describe('StudentReviewInboxControl', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    navigateMock.mockResolvedValue(undefined)
    markReadMock.mockResolvedValue({ ...inboxItem, status: 'READ' })
    useUnreadCountMock.mockReturnValue(unreadCountResult({ unreadCount: 0 }))
    useInboxMock.mockReturnValue(inboxResult([inboxItem]))
    useMarkReadMock.mockReturnValue(markReadResult())
  })

  afterEach(cleanup)

  it('renders the accessible Review Inbox control and consumes its hooks', () => {
    render(<StudentReviewInboxControl />)

    expect(screen.getByRole('button', { name: 'Review inbox' })).toBeVisible()
    expect(useUnreadCountMock).toHaveBeenCalledOnce()
    expect(useInboxMock).toHaveBeenCalledOnce()
    expect(useMarkReadMock).toHaveBeenCalledOnce()
  })

  it('shows the unread count badge only when the count is positive', () => {
    useUnreadCountMock.mockReturnValue(unreadCountResult({ unreadCount: 3 }))
    const { rerender } = render(<StudentReviewInboxControl />)

    expect(screen.getByText('3')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Review inbox, 3 unread' }),
    ).toBeVisible()

    useUnreadCountMock.mockReturnValue(unreadCountResult({ unreadCount: 0 }))
    rerender(<StudentReviewInboxControl />)
    expect(screen.queryByText('0')).toBeNull()
  })

  it('renders safe inbox fields and unread state', async () => {
    const user = userEvent.setup()
    render(<StudentReviewInboxControl />)
    await openInbox(user)

    expect(screen.getByText(inboxItem.title)).toBeVisible()
    expect(screen.getByText(inboxItem.body)).toBeVisible()
    expect(
      document.querySelector(`time[datetime="${inboxItem.createdAt}"]`),
    ).not.toBeNull()
    expect(screen.getByText('Unread review update.')).toHaveClass('sr-only')
  })

  it('navigates directly using the returned identifiers and then marks unread', async () => {
    const user = userEvent.setup()
    render(<StudentReviewInboxControl />)
    await openInbox(user)

    await user.click(screen.getByText(inboxItem.title))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/chat',
      search: {
        courseId: inboxItem.courseId,
        sessionId: inboxItem.sessionId,
      },
      hash: `message-${inboxItem.messageId}`,
    })
    expect(markReadMock).toHaveBeenCalledWith(inboxItem.id)
  })

  it('does not mark an already-read item again', async () => {
    const user = userEvent.setup()
    const readItem = { ...inboxItem, status: 'READ' as const }
    useInboxMock.mockReturnValue(inboxResult([readItem]))
    render(<StudentReviewInboxControl />)
    await openInbox(user)

    await user.click(screen.getByText(readItem.title))

    expect(markReadMock).not.toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledOnce()
  })

  it('keeps the item unread when direct navigation fails', async () => {
    const user = userEvent.setup()
    navigateMock.mockRejectedValue(new Error('destination unavailable'))
    render(<StudentReviewInboxControl />)
    await openInbox(user)

    await user.click(screen.getByText(inboxItem.title))

    expect(markReadMock).not.toHaveBeenCalled()
  })

  it('continues navigation when marking read fails', async () => {
    const user = userEvent.setup()
    markReadMock.mockRejectedValue(new Error('mark read failed'))
    render(<StudentReviewInboxControl />)
    await openInbox(user)

    await user.click(screen.getByText(inboxItem.title))

    await waitFor(() => expect(markReadMock).toHaveBeenCalledOnce())
    expect(navigateMock).toHaveBeenCalledOnce()
  })

  it('guards duplicate item activation synchronously', async () => {
    const user = userEvent.setup()
    let finishMarkRead: (() => void) | undefined
    markReadMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishMarkRead = () => resolve({ ...inboxItem, status: 'READ' })
        }),
    )
    render(<StudentReviewInboxControl />)
    await openInbox(user)
    const item = screen.getByRole('menuitem', {
      name: /Unread review update.*Instructor review completed/,
    })

    fireEvent.click(item)
    fireEvent.click(item)

    await waitFor(() => expect(markReadMock).toHaveBeenCalledOnce())
    finishMarkRead?.()
    await waitFor(() => expect(navigateMock).toHaveBeenCalledOnce())
  })

  it('supports keyboard item selection', async () => {
    const user = userEvent.setup()
    render(<StudentReviewInboxControl />)
    await openInbox(user)
    const item = screen.getByRole('menuitem', {
      name: /Unread review update.*Instructor review completed/,
    })
    item.focus()

    await user.keyboard('{Enter}')

    expect(markReadMock).toHaveBeenCalledWith(inboxItem.id)
    expect(navigateMock).toHaveBeenCalledOnce()
  })

  it('renders empty, error, loading, and pagination states', async () => {
    const user = userEvent.setup()
    useInboxMock.mockReturnValue(inboxResult([]))
    render(<StudentReviewInboxControl />)
    await openInbox(user)
    expect(screen.getByText('No review updates yet.')).toBeVisible()

    cleanup()
    useInboxMock.mockReturnValue(inboxResult([], { isError: true }))
    render(<StudentReviewInboxControl />)
    await openInbox(user)
    expect(screen.getByText('Review inbox could not be loaded.')).toBeVisible()

    cleanup()
    useInboxMock.mockReturnValue(inboxResult([], { isPending: true }))
    render(<StudentReviewInboxControl />)
    await openInbox(user)
    expect(screen.getByText('Loading review inbox…')).toBeVisible()
  })

  it('loads the next page with keyboard activation', async () => {
    const user = userEvent.setup()
    useInboxMock.mockReturnValue(
      inboxResult([inboxItem], { hasNextPage: true }),
    )
    render(<StudentReviewInboxControl />)
    await openInbox(user)

    const loadMoreItem = screen.getByRole('menuitem', { name: 'Load more' })
    loadMoreItem.focus()
    await user.keyboard('{Enter}')

    expect(fetchNextPageMock).toHaveBeenCalledOnce()
  })
})

async function openInbox(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Review inbox/ }))
  await screen.findByRole('menu', { name: 'Review inbox' })
}

function unreadCountResult(
  data: { unreadCount: number } | undefined,
  overrides: { isPending?: boolean; isError?: boolean } = {},
) {
  return {
    data,
    isPending: overrides.isPending ?? false,
    isError: overrides.isError ?? false,
  } as ReturnType<typeof useUnreadStudentReviewInboxCount>
}

function inboxResult(
  items: StudentReviewInboxItem[],
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
  } as unknown as ReturnType<typeof useStudentReviewInbox>
}

function markReadResult() {
  return {
    isPending: false,
    mutateAsync: markReadMock,
    variables: undefined,
  } as unknown as ReturnType<typeof useMarkStudentReviewInboxItemRead>
}
