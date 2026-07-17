import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/features/auth/api/authenticated-api-client'
import type { AuthSession } from '@/features/auth/schemas/auth.schema'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  createStudentSession,
  deleteStudentSession,
  getStudentSessionMessages,
  listStudentSessions,
  renameStudentSession,
} from '@/features/student/data/student-sessions.api'
import { studentCoursesQueryOptions } from '@/features/student/data/student-courses.queries'
import { studentSessionKeys } from '@/features/student/data/student-sessions.queries'
import type {
  ChatMessageHistoryResponse,
  ChatSessionListResponse,
} from '@/features/student/schemas/student-chat.schema'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'
import {
  chatMessageHistoryResponseFixture,
  orderedChatMessagesFixture,
  primaryChatSessionFixture,
  studentChatIds,
} from '@/features/student/testing/student-chat.fixtures'

import { StudentAiTutorPage } from './student-ai-tutor-page'

vi.mock('@/features/student/data/student-sessions.api')

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    search,
    to,
    ...props
  }: {
    children?: React.ReactNode
    search?: Record<string, string>
    to: string
  }) => (
    <a
      href={search ? `${to}?${new URLSearchParams(search).toString()}` : to}
      {...props}
    >
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}))

const createStudentSessionMock = vi.mocked(createStudentSession)
const deleteStudentSessionMock = vi.mocked(deleteStudentSession)
const getStudentSessionMessagesMock = vi.mocked(getStudentSessionMessages)
const listStudentSessionsMock = vi.mocked(listStudentSessions)
const renameStudentSessionMock = vi.mocked(renameStudentSession)
let triggerSessionIntersection: (() => void) | undefined

class TestIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    triggerSessionIntersection = () =>
      callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      )
  }

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

const studentId = 'student-user'
const primaryCourse: StudentCourse = {
  id: studentChatIds.primaryCourse,
  code: 'PYTHON-PROG-P0',
  title: 'Python Programming',
  membershipRole: 'STUDENT',
}
const otherCourse: StudentCourse = {
  id: studentChatIds.otherCourse,
  code: 'JAVASCRIPT-P0',
  title: 'JavaScript Programming',
  membershipRole: 'STUDENT',
}
const secondSession = {
  ...primaryChatSessionFixture,
  id: studentChatIds.otherSession,
  title: 'Functions practice',
}
const thirdMessage = {
  ...orderedChatMessagesFixture[1],
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  sequence: 3,
  content: 'A second persisted page of history.',
}
const orderedMessageHistory: ChatMessageHistoryResponse = {
  messages: chatMessageHistoryResponseFixture.messages.map((message) => ({
    ...message,
  })),
  nextCursor: chatMessageHistoryResponseFixture.nextCursor,
}

function createStudentAuthSession(): AuthSession {
  return {
    tokenType: 'Bearer',
    user: {
      id: studentId,
      email: 'student@morshid.test',
      displayName: 'Test Student',
      role: 'STUDENT',
      status: 'ACTIVE',
      courses: [],
    },
    accessToken: 'student-access-token',
    accessTokenExpiresAt: '2027-07-17T12:00:00.000Z',
    refreshToken: 'student-refresh-token',
    refreshTokenExpiresAt: '2027-07-24T12:00:00.000Z',
  }
}

function renderWorkspace({
  courses = [primaryCourse],
  courseId,
  sessionId,
  sessions,
  messages,
}: {
  courses?: StudentCourse[]
  courseId?: string
  sessionId?: string
  sessions?: ChatSessionListResponse
  messages?: ChatMessageHistoryResponse
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  })
  queryClient.setQueryData(
    studentCoursesQueryOptions(studentId).queryKey,
    courses,
  )

  if (courseId && sessions) {
    queryClient.setQueryData(
      studentSessionKeys.sessionList({ studentId, courseId }),
      { pages: [sessions], pageParams: [undefined] },
    )
  } else if (courses.length === 1 && sessions) {
    queryClient.setQueryData(
      studentSessionKeys.sessionList({
        studentId,
        courseId: courses[0]?.id ?? 'missing-course',
      }),
      { pages: [sessions], pageParams: [undefined] },
    )
  }

  if (courseId && sessionId && messages) {
    queryClient.setQueryData(
      studentSessionKeys.messageList({ studentId, courseId, sessionId }),
      { pages: [messages], pageParams: [undefined] },
    )
  }

  const result = render(
    <QueryClientProvider client={queryClient}>
      <StudentAiTutorPage courseId={courseId} sessionId={sessionId} />
    </QueryClientProvider>,
  )

  return { ...result, queryClient }
}

async function chooseSessionAction(
  sessionTitle: string,
  action: 'Rename' | 'Delete',
) {
  fireEvent.click(
    screen.getByRole('button', {
      name: `Open actions for ${sessionTitle}`,
    }),
  )
  fireEvent.click(await screen.findByRole('menuitem', { name: action }))
}

describe('StudentAiTutorPage workspace', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    triggerSessionIntersection = undefined
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)
    getStudentSessionMessagesMock.mockResolvedValue({
      messages: [],
      nextCursor: null,
    })
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
    useAuthStore.getState().setSession(createStudentAuthSession())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })

  it('shows the no-course state without requesting sessions', () => {
    renderWorkspace({ courses: [] })

    expect(
      screen.getByRole('heading', { name: 'No assigned course' }),
    ).toBeInTheDocument()
    expect(listStudentSessionsMock).not.toHaveBeenCalled()
  })

  it('shows the selected course with an empty private session list', () => {
    renderWorkspace({ sessions: { sessions: [], nextCursor: null } })

    expect(
      screen.getByRole('heading', { name: primaryCourse.title }),
    ).toBeInTheDocument()
    expect(screen.getByText(primaryCourse.code)).toBeInTheDocument()
    expect(screen.getByText('Private workspace')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'No conversations yet' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toBeDisabled()
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
  })

  it('uses explicit course routing when multiple courses are assigned', () => {
    renderWorkspace({
      courses: [primaryCourse, otherCourse],
      courseId: otherCourse.id,
      sessions: { sessions: [], nextCursor: null },
    })

    expect(
      screen.getByRole('heading', { name: otherCourse.title }),
    ).toBeInTheDocument()
    expect(screen.getByText(otherCourse.code)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: primaryCourse.title }),
    ).toHaveAttribute('href', `/student/ai-tutor?courseId=${primaryCourse.id}`)
  })

  it('routes session selection and marks the selected conversation', () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: secondSession.id,
      sessions: {
        sessions: [primaryChatSessionFixture, secondSession],
        nextCursor: null,
      },
    })

    const conversations = screen.getByRole('navigation', {
      name: 'Course conversations',
    })
    const selectedLink = screen.getByRole('link', {
      name: /functions practice/i,
    })
    const conversationList = screen.getByRole('region', {
      name: 'Conversation list',
    })

    expect(selectedLink).toHaveAttribute('aria-current', 'page')
    expect(selectedLink).toHaveAttribute(
      'href',
      `/student/ai-tutor?courseId=${primaryCourse.id}&sessionId=${secondSession.id}`,
    )
    expect(
      screen.getByRole('heading', { name: secondSession.title }),
    ).toBeInTheDocument()
    expect(conversations.closest('aside')).toHaveClass(
      'border-b',
      'md:border-r',
    )
    expect(conversationList).toHaveAttribute('tabindex', '0')
    expect(conversationList).toHaveClass(
      'scrollbar-themed',
      'overflow-y-auto',
      'overscroll-contain',
    )
  })

  it('recovers the routed course, session, and persisted history after refresh', async () => {
    listStudentSessionsMock.mockResolvedValueOnce({
      sessions: [{ ...primaryChatSessionFixture }],
      nextCursor: null,
    })
    getStudentSessionMessagesMock.mockResolvedValueOnce(orderedMessageHistory)

    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
    })

    expect(
      screen.getByRole('status', { name: 'Loading conversations' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(orderedChatMessagesFixture[0].content),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: primaryChatSessionFixture.title }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /python lists/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(listStudentSessionsMock).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: primaryCourse.id }),
    )
    expect(getStudentSessionMessagesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: primaryCourse.id,
        sessionId: primaryChatSessionFixture.id,
      }),
    )
  })

  it('shows a safe stale-session state', () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: studentChatIds.otherSession,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
    })

    expect(
      screen.getByRole('heading', { name: 'Conversation unavailable' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(secondSession.title)).not.toBeInTheDocument()
  })

  it('shows loading and supports retry after a session-list failure', async () => {
    listStudentSessionsMock.mockRejectedValueOnce(new Error('Network failure'))
    listStudentSessionsMock.mockResolvedValueOnce({
      sessions: [],
      nextCursor: null,
    })
    renderWorkspace({ courseId: primaryCourse.id })

    expect(
      screen.getByRole('status', { name: 'Loading conversations' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Sessions unavailable')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'No conversations yet' }),
      ).toBeInTheDocument(),
    )
    expect(listStudentSessionsMock).toHaveBeenCalledTimes(2)
  })

  it('loads additional session pages while scrolling inside the selected course', async () => {
    listStudentSessionsMock.mockResolvedValueOnce({
      sessions: [{ ...primaryChatSessionFixture }],
      nextCursor: primaryChatSessionFixture.id,
    })
    listStudentSessionsMock.mockResolvedValueOnce({
      sessions: [secondSession],
      nextCursor: null,
    })
    renderWorkspace({ courseId: primaryCourse.id })

    expect(
      await screen.findByRole('link', { name: /python lists/i }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(triggerSessionIntersection).toBeTypeOf('function'),
    )
    act(() => triggerSessionIntersection?.())

    expect(
      await screen.findByRole('link', { name: /functions practice/i }),
    ).toBeInTheDocument()
    expect(listStudentSessionsMock).toHaveBeenNthCalledWith(2, {
      courseId: primaryCourse.id,
      input: { limit: 25, cursor: primaryChatSessionFixture.id },
    })
  })

  it('keeps loaded sessions visible when infinite scrolling needs a retry', async () => {
    listStudentSessionsMock.mockResolvedValueOnce({
      sessions: [{ ...primaryChatSessionFixture }],
      nextCursor: primaryChatSessionFixture.id,
    })
    listStudentSessionsMock.mockRejectedValueOnce(new Error('Network failure'))
    listStudentSessionsMock.mockResolvedValueOnce({
      sessions: [secondSession],
      nextCursor: null,
    })
    renderWorkspace({ courseId: primaryCourse.id })

    expect(
      await screen.findByRole('link', { name: /python lists/i }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(triggerSessionIntersection).toBeTypeOf('function'),
    )
    act(() => triggerSessionIntersection?.())

    expect(
      await screen.findByText('More conversations could not be loaded.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /python lists/i }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByRole('link', { name: /functions practice/i }),
    ).toBeInTheDocument()
  })

  it('creates and selects a new conversation with pending and retry states', async () => {
    let rejectCreate: ((error: Error) => void) | undefined
    createStudentSessionMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectCreate = reject
        }),
    )
    const { queryClient, rerender } = renderWorkspace({
      courseId: primaryCourse.id,
      sessions: { sessions: [], nextCursor: null },
    })

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(
      await screen.findByRole('button', { name: 'Creating…' }),
    ).toBeDisabled()
    await waitFor(() => expect(rejectCreate).toBeTypeOf('function'))

    if (!rejectCreate) {
      throw new Error('Expected create request to be pending')
    }
    rejectCreate(new Error('Create failed'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Create failed')

    createStudentSessionMock.mockResolvedValueOnce(primaryChatSessionFixture)
    listStudentSessionsMock.mockResolvedValueOnce({
      sessions: [primaryChatSessionFixture],
      nextCursor: null,
    })
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/student/ai-tutor',
        search: {
          courseId: primaryCourse.id,
          sessionId: primaryChatSessionFixture.id,
        },
      }),
    )

    rerender(
      <QueryClientProvider client={queryClient}>
        <StudentAiTutorPage
          courseId={primaryCourse.id}
          sessionId={primaryChatSessionFixture.id}
        />
      </QueryClientProvider>,
    )
    expect(
      await screen.findByRole('heading', { name: 'No messages yet' }),
    ).toBeInTheDocument()
    expect(getStudentSessionMessagesMock).not.toHaveBeenCalled()
  })

  it('validates and renames a conversation in the scoped list', async () => {
    const renamedSession = {
      ...primaryChatSessionFixture,
      title: 'Renamed Python chat',
    }
    renameStudentSessionMock.mockResolvedValueOnce(renamedSession)
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
    })

    await chooseSessionAction(primaryChatSessionFixture.title, 'Rename')
    const titleInput = screen.getByRole('textbox', {
      name: `Rename ${primaryChatSessionFixture.title}`,
    })

    expect(titleInput).toHaveFocus()
    expect(titleInput).toHaveValue(primaryChatSessionFixture.title)
    fireEvent.change(titleInput, { target: { value: '   ' } })
    fireEvent.submit(titleInput.closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a conversation title.',
    )
    expect(renameStudentSessionMock).not.toHaveBeenCalled()

    fireEvent.change(titleInput, { target: { value: renamedSession.title } })
    fireEvent.blur(titleInput)

    await waitFor(() =>
      expect(renameStudentSessionMock).toHaveBeenCalledWith({
        courseId: primaryCourse.id,
        sessionId: primaryChatSessionFixture.id,
        input: { title: renamedSession.title },
      }),
    )
    expect(
      await screen.findByRole('link', { name: /renamed python chat/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: `Open actions for ${renamedSession.title}`,
      }),
    ).toBeEnabled()
  })

  it('re-enables rename after a failed request so the Student can retry', async () => {
    const renamedSession = {
      ...primaryChatSessionFixture,
      title: 'Retry rename',
    }
    renameStudentSessionMock.mockRejectedValueOnce(new Error('Rename failed'))
    renameStudentSessionMock.mockResolvedValueOnce(renamedSession)
    renderWorkspace({
      courseId: primaryCourse.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
    })

    await chooseSessionAction(primaryChatSessionFixture.title, 'Rename')
    const titleInput = screen.getByRole('textbox', {
      name: `Rename ${primaryChatSessionFixture.title}`,
    })
    fireEvent.change(titleInput, {
      target: { value: renamedSession.title },
    })
    fireEvent.submit(titleInput.closest('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent('Rename failed')
    expect(titleInput).toBeEnabled()

    fireEvent.submit(titleInput.closest('form')!)
    expect(
      await screen.findByRole('link', { name: /retry rename/i }),
    ).toBeInTheDocument()
  })

  it('cancels inline rename with Escape without mutating the session', async () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
    })

    await chooseSessionAction(primaryChatSessionFixture.title, 'Rename')
    const titleInput = screen.getByRole('textbox', {
      name: `Rename ${primaryChatSessionFixture.title}`,
    })
    fireEvent.change(titleInput, { target: { value: 'Discard this title' } })
    fireEvent.keyDown(titleInput, { key: 'Escape' })

    expect(
      screen.queryByRole('textbox', {
        name: `Rename ${primaryChatSessionFixture.title}`,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /python lists/i }),
    ).toBeInTheDocument()
    expect(renameStudentSessionMock).not.toHaveBeenCalled()
  })

  it('cancels deletion and recovers routing after confirmed deletion', async () => {
    deleteStudentSessionMock.mockResolvedValueOnce(undefined)
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
    })

    await chooseSessionAction(primaryChatSessionFixture.title, 'Delete')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(deleteStudentSessionMock).not.toHaveBeenCalled()

    await chooseSessionAction(primaryChatSessionFixture.title, 'Delete')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(deleteStudentSessionMock).toHaveBeenCalledWith({
        courseId: primaryCourse.id,
        sessionId: primaryChatSessionFixture.id,
      }),
    )
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/student/ai-tutor',
      search: { courseId: primaryCourse.id },
    })
  })

  it('keeps the delete confirmation open when the server rejects deletion', async () => {
    deleteStudentSessionMock.mockRejectedValueOnce(new Error('Delete failed'))
    renderWorkspace({
      courseId: primaryCourse.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
    })

    await chooseSessionAction(primaryChatSessionFixture.title, 'Delete')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Delete failed')
    expect(
      screen.getByRole('heading', { name: 'Delete conversation?' }),
    ).toBeInTheDocument()
    const retryDelete = screen.getByRole('button', { name: 'Delete' })
    expect(retryDelete).toBeEnabled()

    fireEvent.click(retryDelete)
    await waitFor(() =>
      expect(deleteStudentSessionMock).toHaveBeenCalledTimes(2),
    )
  })

  it('renders persisted messages in the server-provided sequence order', () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: orderedMessageHistory,
    })

    const history = screen.getByRole('list', { name: 'Conversation history' })
    const messageItems = history.querySelectorAll('li')

    expect(messageItems).toHaveLength(2)
    expect(messageItems[0]).toHaveTextContent(
      orderedChatMessagesFixture[0].content,
    )
    expect(messageItems[1]).toHaveTextContent(
      orderedChatMessagesFixture[1].content,
    )
    expect(screen.getByLabelText('Message')).toBeDisabled()
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
  })

  it('appends additional history pages in stable sequence order', async () => {
    getStudentSessionMessagesMock.mockResolvedValueOnce({
      messages: orderedMessageHistory.messages,
      nextCursor: 2,
    })
    getStudentSessionMessagesMock.mockResolvedValueOnce({
      messages: [thirdMessage],
      nextCursor: null,
    })
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
    })

    expect(
      await screen.findByRole('button', { name: 'Load more messages' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Load more messages' }))

    expect(await screen.findByText(thirdMessage.content)).toBeInTheDocument()
    const messageItems = screen
      .getByRole('list', { name: 'Conversation history' })
      .querySelectorAll('li')
    expect(messageItems).toHaveLength(3)
    expect(messageItems[2]).toHaveTextContent(thirdMessage.content)
    expect(getStudentSessionMessagesMock).toHaveBeenNthCalledWith(2, {
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      input: { limit: 50, after: 2 },
    })
  })

  it('shows an empty state when the selected conversation has no messages', () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: { messages: [], nextCursor: null },
    })

    expect(
      screen.getByRole('heading', { name: 'No messages yet' }),
    ).toBeInTheDocument()
  })

  it('keeps the history area visually stable while messages are pending', () => {
    getStudentSessionMessagesMock.mockReturnValueOnce(new Promise(() => {}))
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
    })

    const pendingHistory = screen.getByRole('status', {
      name: 'Loading conversation history',
    })
    expect(pendingHistory).toBeEmptyDOMElement()
    expect(pendingHistory).toHaveAttribute('aria-busy', 'true')
    expect(
      screen.queryByText(/loading your private workspace/i),
    ).not.toBeInTheDocument()
  })

  it('retries history after a server or network failure', async () => {
    getStudentSessionMessagesMock.mockRejectedValueOnce(
      new Error('Network failure'),
    )
    getStudentSessionMessagesMock.mockResolvedValueOnce(orderedMessageHistory)
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
    })

    expect(
      await screen.findByRole('heading', { name: 'History unavailable' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(
      await screen.findByRole('list', { name: 'Conversation history' }),
    ).toBeInTheDocument()
    expect(getStudentSessionMessagesMock).toHaveBeenCalledTimes(2)
  })

  it('recovers safely when selected history belongs to a deleted session', async () => {
    getStudentSessionMessagesMock.mockRejectedValueOnce(
      new ApiError('Session not found', 404, 'STUDENT_CHAT_SESSION_NOT_FOUND'),
    )
    listStudentSessionsMock.mockResolvedValueOnce({
      sessions: [],
      nextCursor: null,
    })
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
    })

    expect(
      await screen.findByRole('heading', { name: 'Conversation unavailable' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(orderedChatMessagesFixture[0].content),
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Return to conversations' }),
    )

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/student/ai-tutor',
        search: { courseId: primaryCourse.id },
      }),
    )
  })
})
