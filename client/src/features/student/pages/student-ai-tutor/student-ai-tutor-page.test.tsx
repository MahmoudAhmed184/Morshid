import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/http'
import type { AuthSession } from '@/features/auth/schemas/auth.schema'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { ThemeProvider } from '@/providers/theme-provider'
import {
  createStudentSession,
  deleteStudentSession,
  getStudentSession,
  getStudentSessionMessages,
  listStudentSessions,
  renameStudentSession,
  retryStudentChatMessage,
  sendStudentChatMessage,
} from '@/features/student/data/student-sessions.api'
import { studentCoursesQueryOptions } from '@/features/student/data/student-courses.queries'
import { studentSessionKeys } from '@/features/student/data/student-sessions.queries'
import type {
  ChatMessageHistoryResponse,
  ChatSession,
  ChatSessionListResponse,
  GroundedChatTurnResponse,
} from '@/features/student/schemas/student-chat.schema'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'
import {
  chatMessageHistoryResponseFixture,
  groundedChatTurnResponseFixture,
  orderedChatMessagesFixture,
  primaryChatSessionFixture,
  studentChatIds,
} from '@/features/student/testing/student-chat.fixtures'

import { StudentAiTutorPage } from './student-ai-tutor-page'
import {
  STUDENT_CHAT_COMPLETION_STATUS,
  STUDENT_CHAT_GENERATION_STATUS,
} from './student-chat-status'

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
  ScriptOnce: () => null,
  useNavigate: () => navigateMock,
}))

const createStudentSessionMock = vi.mocked(createStudentSession)
const deleteStudentSessionMock = vi.mocked(deleteStudentSession)
const getStudentSessionMock = vi.mocked(getStudentSession)
const getStudentSessionMessagesMock = vi.mocked(getStudentSessionMessages)
const listStudentSessionsMock = vi.mocked(listStudentSessions)
const renameStudentSessionMock = vi.mocked(renameStudentSession)
const retryStudentChatMessageMock = vi.mocked(retryStudentChatMessage)
const sendStudentChatMessageMock = vi.mocked(sendStudentChatMessage)
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

function failedGroundedTurn(): GroundedChatTurnResponse {
  return {
    studentMessage: { ...groundedChatTurnResponseFixture.studentMessage },
    assistantMessage: {
      ...groundedChatTurnResponseFixture.assistantMessage,
      content: 'I could not complete a grounded response right now.',
      status: 'FAILED',
      guidanceLabel: null,
      errorCode: 'GROUNDING_RESPONSE_FAILED',
      citations: [],
    },
  }
}

function createStudentAuthSession(id: string = studentId): AuthSession {
  return {
    tokenType: 'Bearer',
    user: {
      id,
      email: `${id}@morshid.test`,
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
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )

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
      <ThemeProvider defaultTheme="system" storageKey="test-theme">
        <StudentAiTutorPage courseId={courseId} sessionId={sessionId} />
      </ThemeProvider>
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
    listStudentSessionsMock.mockResolvedValue({
      sessions: [primaryChatSessionFixture],
      nextCursor: null,
    })
    getStudentSessionMock.mockImplementation(async ({ sessionId }) =>
      sessionId === secondSession.id
        ? secondSession
        : primaryChatSessionFixture,
    )
    retryStudentChatMessageMock.mockResolvedValue(
      groundedChatTurnResponseFixture,
    )
    sendStudentChatMessageMock.mockResolvedValue(
      groundedChatTurnResponseFixture,
    )
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
      screen.getByRole('button', {
        name: `Current course: ${primaryCourse.code} ${primaryCourse.title}. Choose course`,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(`${primaryCourse.code} · ${primaryCourse.title}`),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('searchbox', { name: 'Search sessions' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'No conversations yet' }),
    ).toBeInTheDocument()
    const openSessions = screen.getByRole('button', { name: 'Open sessions' })
    expect(openSessions).toBeInTheDocument()
    expect(openSessions).not.toHaveClass('fixed')
    expect(screen.getByText('Courses & chats')).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toBeDisabled()
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
  })

  it('uses explicit course routing when multiple courses are assigned', async () => {
    renderWorkspace({
      courses: [primaryCourse, otherCourse],
      courseId: otherCourse.id,
      sessions: { sessions: [], nextCursor: null },
    })

    const courseSwitcher = screen.getByRole('button', {
      name: `Current course: ${otherCourse.code} ${otherCourse.title}. Choose course`,
    })

    expect(courseSwitcher).toBeInTheDocument()
    expect(
      screen.getByText(`${otherCourse.code} · ${otherCourse.title}`),
    ).toBeInTheDocument()

    fireEvent.click(courseSwitcher)

    expect(
      await screen.findByRole('menuitem', {
        name: new RegExp(`${primaryCourse.code}.*${primaryCourse.title}`),
      }),
    ).toHaveAttribute('href', `/student/ai-tutor?courseId=${primaryCourse.id}`)
  })

  it('does not expose the excluded session search feature', () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessions: {
        sessions: [primaryChatSessionFixture, secondSession],
        nextCursor: null,
      },
    })

    expect(
      screen.getByRole('link', { name: /functions practice/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /python lists/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('opens sessions in a mobile drawer and closes it after navigation', async () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessions: {
        sessions: [primaryChatSessionFixture, secondSession],
        nextCursor: null,
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open sessions' }))

    const drawer = await screen.findByRole('dialog', {
      name: 'Course sessions',
    })
    expect(drawer).toHaveAttribute('data-side', 'left')
    expect(drawer).toHaveClass('w-[80vw]!', 'rounded-lg')
    expect(within(drawer).queryByRole('searchbox')).not.toBeInTheDocument()

    fireEvent.click(
      within(drawer).getByRole('link', { name: /functions practice/i }),
    )

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Course sessions' }),
      ).toBeNull(),
    )
  })

  it('routes session selection and marks the selected conversation', async () => {
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
      await screen.findByRole('heading', { name: secondSession.title }),
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

  it('keeps the grounded composer free of an attachment workflow', async () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: { messages: [], nextCursor: null },
    })

    expect(screen.queryByLabelText('Choose files')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Attach file' }),
    ).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Message')).toBeEnabled())
  })

  it('keeps sending disabled for an empty question without showing an error', async () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: { messages: [], nextCursor: null },
    })

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled(),
    )
    const composer = screen.getByRole('textbox', { name: 'Message' })
    const sendButton = screen.getByRole('button', { name: 'Send message' })

    expect(sendButton).toBeDisabled()
    fireEvent.keyDown(composer, { key: 'Enter' })

    expect(sendStudentChatMessageMock).not.toHaveBeenCalled()
    expect(
      screen.queryByText('Enter a question before sending.'),
    ).not.toBeInTheDocument()
  })

  it('accepts valid astral Unicode content using code-point limits', async () => {
    const unicodeQuestion = `  ${'😀'.repeat(2_001)}  `
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: { messages: [], nextCursor: null },
    })

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled(),
    )
    const composer = screen.getByRole('textbox', { name: 'Message' })
    fireEvent.change(composer, { target: { value: unicodeQuestion } })

    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() =>
      expect(sendStudentChatMessageMock).toHaveBeenCalledWith({
        courseId: primaryCourse.id,
        sessionId: primaryChatSessionFixture.id,
        input: {
          clientMessageId: expect.any(String),
          content: '😀'.repeat(2_001),
        },
      }),
    )
  })

  it('caps composed content at 4,000 Unicode code points', async () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: { messages: [], nextCursor: null },
    })

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled(),
    )
    const composer = screen.getByRole('textbox', { name: 'Message' })
    fireEvent.change(composer, {
      target: { value: `  ${'😀'.repeat(4_001)}` },
    })

    expect(
      Array.from((composer as HTMLTextAreaElement).value.trim()),
    ).toHaveLength(4_000)
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled()
  })

  it('uses semantic theme tokens throughout the workspace', () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: orderedMessageHistory,
    })

    expect(screen.getByLabelText('Student AI Tutor')).toHaveClass(
      'bg-background',
      'text-foreground',
    )
    expect(screen.getByLabelText('Session navigation')).toHaveClass(
      'border-border',
      'bg-sidebar',
    )
    expect(screen.getByRole('link', { name: /python lists/i })).toHaveClass(
      'bg-sidebar-accent',
      'text-sidebar-accent-foreground',
    )
  })

  it('connects grounded responses to guidance labels and the sources panel', async () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: orderedMessageHistory,
    })

    expect(await screen.findByText('GROUNDED IN COURSE SOURCES')).toBeVisible()
    const sourcesPanel = screen.getByLabelText('Sources and citations')
    expect(
      within(sourcesPanel).getByText('Cited in this conversation'),
    ).toBeVisible()
    expect(within(sourcesPanel).getByText('Python lists')).toBeVisible()
    expect(
      within(sourcesPanel).getByText(
        'Python lists are ordered and mutable collections.',
      ),
    ).toBeVisible()
  })

  it('contains responsive scrolling inside the conversation viewport', async () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: orderedMessageHistory,
    })

    const workspace = screen.getByLabelText('Student AI Tutor')
    const workspaceGrid = workspace.firstElementChild
    const conversationArea = await screen.findByRole('region', {
      name: 'Conversation messages',
    })
    const composer = screen.getByRole('form', { name: 'Message composer' })

    expect(workspace).toHaveClass(
      'h-0',
      'min-h-0',
      'overflow-hidden',
      'overscroll-none',
    )
    expect(workspaceGrid).toHaveClass('h-full', 'overflow-hidden')
    expect(conversationArea).toHaveClass(
      'overflow-y-auto',
      'overscroll-contain',
    )
    expect(composer.closest('footer')).toHaveClass('shrink-0')
  })

  it('recovers a routed session beyond the first page after refresh', async () => {
    listStudentSessionsMock.mockResolvedValueOnce({
      sessions: [{ ...primaryChatSessionFixture }],
      nextCursor: primaryChatSessionFixture.id,
    })
    getStudentSessionMock.mockResolvedValueOnce(secondSession)
    getStudentSessionMessagesMock.mockResolvedValueOnce(orderedMessageHistory)

    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: secondSession.id,
    })

    expect(
      screen.getByRole('status', { name: 'Loading conversations' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(orderedChatMessagesFixture[0].content),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: secondSession.title }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /functions practice/i }),
    ).toHaveAttribute('aria-current', 'page')
    expect(listStudentSessionsMock).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: primaryCourse.id }),
    )
    expect(getStudentSessionMock).toHaveBeenCalledWith({
      courseId: primaryCourse.id,
      sessionId: secondSession.id,
    })
    expect(getStudentSessionMessagesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: primaryCourse.id,
        sessionId: secondSession.id,
      }),
    )
  })

  it('shows a safe stale-session state', async () => {
    getStudentSessionMock.mockRejectedValueOnce(
      new ApiError('Session not found', 404, 'STUDENT_CHAT_SESSION_NOT_FOUND'),
    )
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: studentChatIds.otherSession,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
    })

    expect(
      await screen.findByRole('heading', { name: 'Conversation unavailable' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(secondSession.title)).not.toBeInTheDocument()
    expect(getStudentSessionMessagesMock).not.toHaveBeenCalled()
  })

  it('retries a routed-session network failure without loading history', async () => {
    getStudentSessionMock.mockRejectedValueOnce(new Error('Network failure'))
    getStudentSessionMock.mockResolvedValueOnce(secondSession)
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: secondSession.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: primaryChatSessionFixture.id,
      },
    })

    expect(
      await screen.findByText('The selected conversation could not be loaded.'),
    ).toBeInTheDocument()
    expect(getStudentSessionMessagesMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(
      await screen.findByRole('heading', { name: secondSession.title }),
    ).toBeInTheDocument()
    expect(getStudentSessionMessagesMock).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: secondSession.id }),
    )
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
        <ThemeProvider defaultTheme="system" storageKey="test-theme">
          <StudentAiTutorPage
            courseId={primaryCourse.id}
            sessionId={primaryChatSessionFixture.id}
          />
        </ThemeProvider>
      </QueryClientProvider>,
    )
    expect(
      await screen.findByRole('heading', {
        name: 'What can I help you learn?',
      }),
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

  it('prevents overlapping lifecycle mutations across session rows', async () => {
    let resolveRename: ((session: ChatSession) => void) | undefined
    renameStudentSessionMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRename = resolve
        }),
    )
    renderWorkspace({
      courseId: primaryCourse.id,
      sessions: {
        sessions: [primaryChatSessionFixture, secondSession],
        nextCursor: null,
      },
    })

    await chooseSessionAction(primaryChatSessionFixture.title, 'Rename')
    const titleInput = screen.getByRole('textbox', {
      name: `Rename ${primaryChatSessionFixture.title}`,
    })
    fireEvent.change(titleInput, { target: { value: 'Pending rename' } })
    fireEvent.submit(titleInput.closest('form')!)

    await waitFor(() => expect(resolveRename).toBeTypeOf('function'))
    expect(titleInput).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: `Open actions for ${secondSession.title}`,
      }),
    ).toBeDisabled()

    if (!resolveRename) {
      throw new Error('Expected rename request to be pending')
    }

    resolveRename({ ...primaryChatSessionFixture, title: 'Pending rename' })
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: `Open actions for ${secondSession.title}`,
        }),
      ).toBeEnabled(),
    )
  })

  it('disables every open rename editor while one rename is pending', async () => {
    let resolveRename: ((session: ChatSession) => void) | undefined
    renameStudentSessionMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRename = resolve
        }),
    )
    renderWorkspace({
      courseId: primaryCourse.id,
      sessions: {
        sessions: [primaryChatSessionFixture, secondSession],
        nextCursor: null,
      },
    })

    await chooseSessionAction(primaryChatSessionFixture.title, 'Rename')
    const firstTitleInput = screen.getByRole('textbox', {
      name: `Rename ${primaryChatSessionFixture.title}`,
    })
    fireEvent.change(firstTitleInput, { target: { value: '   ' } })
    fireEvent.submit(firstTitleInput.closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a conversation title.',
    )
    await chooseSessionAction(secondSession.title, 'Rename')
    const secondTitleInput = screen.getByRole('textbox', {
      name: `Rename ${secondSession.title}`,
    })
    fireEvent.change(secondTitleInput, {
      target: { value: 'Pending second rename' },
    })
    fireEvent.submit(secondTitleInput.closest('form')!)

    await waitFor(() => expect(resolveRename).toBeTypeOf('function'))
    expect(firstTitleInput).toBeDisabled()
    expect(secondTitleInput).toBeDisabled()

    fireEvent.change(firstTitleInput, {
      target: { value: 'Overlapping first rename' },
    })
    fireEvent.submit(firstTitleInput.closest('form')!)
    expect(renameStudentSessionMock).toHaveBeenCalledTimes(1)

    if (!resolveRename) {
      throw new Error('Expected rename request to be pending')
    }

    resolveRename({ ...secondSession, title: 'Pending second rename' })
    await waitFor(() => expect(firstTitleInput).toBeEnabled())
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

  it('renders persisted messages in the server-provided sequence order', async () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: orderedMessageHistory,
    })

    const history = await screen.findByRole('list', {
      name: 'Conversation history',
    })
    const messageItems = history.querySelectorAll(':scope > li')

    expect(messageItems).toHaveLength(2)
    expect(messageItems[0]).toHaveTextContent(
      orderedChatMessagesFixture[0].content,
    )
    expect(messageItems[1]).toHaveTextContent(
      orderedChatMessagesFixture[1].content,
    )
    expect(screen.getByLabelText('Message')).toBeEnabled()
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
  })

  it('requests the newest message page when a conversation opens', async () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
    })

    await waitFor(() =>
      expect(getStudentSessionMessagesMock).toHaveBeenCalledWith({
        courseId: primaryCourse.id,
        sessionId: primaryChatSessionFixture.id,
        input: { limit: 50, page: 'latest' },
      }),
    )
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
      await screen.findByRole('button', { name: 'Load earlier messages' }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Load earlier messages' }),
    )

    expect(await screen.findByText(thirdMessage.content)).toBeInTheDocument()
    const messageItems = screen
      .getByRole('list', { name: 'Conversation history' })
      .querySelectorAll(':scope > li')
    expect(messageItems).toHaveLength(3)
    expect(messageItems[2]).toHaveTextContent(thirdMessage.content)
    expect(getStudentSessionMessagesMock).toHaveBeenNthCalledWith(2, {
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      input: { limit: 50, before: 2 },
    })
  })

  it('keeps cached history visible when loading the next page fails', async () => {
    getStudentSessionMessagesMock.mockResolvedValueOnce({
      messages: orderedMessageHistory.messages,
      nextCursor: 2,
    })
    getStudentSessionMessagesMock.mockRejectedValueOnce(
      new Error('Network failure'),
    )
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

    fireEvent.click(
      await screen.findByRole('button', { name: 'Load earlier messages' }),
    )

    expect(
      await screen.findByText('More messages could not be loaded.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(orderedChatMessagesFixture[0].content),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading messages' }),
    )
    expect(await screen.findByText(thirdMessage.content)).toBeInTheDocument()
  })

  it('keeps cached history visible when a background refresh fails', async () => {
    const { queryClient } = renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: orderedMessageHistory,
    })
    getStudentSessionMessagesMock.mockRejectedValueOnce(
      new Error('Network failure'),
    )

    await queryClient.refetchQueries({
      queryKey: studentSessionKeys.messageList({
        studentId,
        courseId: primaryCourse.id,
        sessionId: primaryChatSessionFixture.id,
      }),
    })

    expect(
      await screen.findByText('Conversation refresh failed.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(orderedChatMessagesFixture[0].content),
    ).toBeInTheDocument()
  })

  it('shows an empty state when the selected conversation has no messages', async () => {
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
      await screen.findByRole('heading', {
        name: 'What can I help you learn?',
      }),
    ).toBeInTheDocument()
  })

  it('opens persisted history at its latest message', async () => {
    const scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockReturnValue(900)

    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: orderedMessageHistory,
    })

    await waitFor(() =>
      expect(
        screen.getByRole('region', {
          name: 'Conversation messages',
        }).scrollTop,
      ).toBe(900),
    )
    scrollHeightSpy.mockRestore()
  })

  it('keeps the composer disabled for a persisted active response after refresh', async () => {
    const pendingHistory: ChatMessageHistoryResponse = {
      messages: [
        groundedChatTurnResponseFixture.studentMessage,
        {
          ...groundedChatTurnResponseFixture.assistantMessage,
          status: 'PENDING',
          content: '',
          completedAt: null,
          guidanceLabel: null,
          citations: [],
        },
      ],
      nextCursor: null,
    }
    const { queryClient } = renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: pendingHistory,
    })

    expect(await screen.findByLabelText('Message')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(
      await screen.findByRole('status', {
        name: STUDENT_CHAT_GENERATION_STATUS,
      }),
    ).toBeInTheDocument()
    expect(sendStudentChatMessageMock).not.toHaveBeenCalled()

    act(() => {
      queryClient.setQueryData(
        studentSessionKeys.messageList({
          studentId,
          courseId: primaryCourse.id,
          sessionId: primaryChatSessionFixture.id,
        }),
        {
          pages: [
            {
              messages: [
                groundedChatTurnResponseFixture.studentMessage,
                groundedChatTurnResponseFixture.assistantMessage,
              ],
              nextCursor: null,
            },
          ],
          pageParams: [undefined],
        },
      )
    })

    expect(
      await screen.findByRole('status', {
        name: STUDENT_CHAT_COMPLETION_STATUS,
      }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toBeEnabled()
  })

  it('leaves the conversation area blank while messages are pending', () => {
    getStudentSessionMessagesMock.mockReturnValueOnce(new Promise(() => {}))
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
    })

    const conversationArea = screen.getByRole('region', {
      name: 'Conversation messages',
    })
    expect(conversationArea.textContent).toBe('')
    expect(
      screen.queryByRole('status', { name: 'Loading conversation history' }),
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

  it('renders the Student message immediately and locks one active generation', async () => {
    let resolveTurn: ((turn: GroundedChatTurnResponse) => void) | undefined
    sendStudentChatMessageMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTurn = resolve
        }),
    )
    getStudentSessionMessagesMock.mockResolvedValueOnce(orderedMessageHistory)
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: { messages: [], nextCursor: null },
    })

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled(),
    )
    const composer = screen.getByRole('textbox', { name: 'Message' })
    fireEvent.change(composer, {
      target: { value: groundedChatTurnResponseFixture.studentMessage.content },
    })
    fireEvent.keyDown(composer, { key: 'Enter' })

    expect(
      await screen.findByText(
        groundedChatTurnResponseFixture.studentMessage.content,
      ),
    ).toBeInTheDocument()
    await waitFor(() => expect(composer).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(
      screen.getByRole('status', {
        name: STUDENT_CHAT_GENERATION_STATUS,
      }),
    ).toBeInTheDocument()
    expect(sendStudentChatMessageMock).toHaveBeenCalledWith({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      input: {
        clientMessageId: expect.any(String),
        content: groundedChatTurnResponseFixture.studentMessage.content,
      },
    })

    const completeTurn = resolveTurn
    if (!completeTurn) {
      throw new Error('Expected a pending grounded response')
    }

    await act(async () => completeTurn(groundedChatTurnResponseFixture))

    expect(
      await screen.findByText(
        groundedChatTurnResponseFixture.assistantMessage.content,
      ),
    ).toBeInTheDocument()
    expect(composer).toBeEnabled()
    expect(composer).toHaveValue('')
    expect(composer).toHaveFocus()
    expect(
      screen
        .getByRole('list', { name: 'Conversation history' })
        .querySelectorAll(':scope > li'),
    ).toHaveLength(2)
  })

  it('keeps a failed network send editable and retryable from the composer', async () => {
    sendStudentChatMessageMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(groundedChatTurnResponseFixture)
    getStudentSessionMessagesMock
      .mockResolvedValueOnce({ messages: [], nextCursor: null })
      .mockResolvedValueOnce(orderedMessageHistory)
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: { messages: [], nextCursor: null },
    })

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled(),
    )
    const composer = screen.getByRole('textbox', { name: 'Message' })
    fireEvent.change(composer, { target: { value: 'Keep my exact question' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(
      await screen.findByText(
        'Your message could not be sent. It remains in the composer so you can try again.',
      ),
    ).toBeInTheDocument()
    expect(composer).toBeEnabled()
    expect(composer).toHaveValue('Keep my exact question')

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(
      await screen.findByText(
        groundedChatTurnResponseFixture.assistantMessage.content,
      ),
    ).toBeInTheDocument()
    expect(sendStudentChatMessageMock).toHaveBeenCalledTimes(2)
    const firstId =
      sendStudentChatMessageMock.mock.calls[0]?.[0].input.clientMessageId
    const secondId =
      sendStudentChatMessageMock.mock.calls[1]?.[0].input.clientMessageId
    expect(firstId).toMatch(/^[0-9a-f-]{36}$/)
    expect(secondId).toBe(firstId)
  })

  it('does not expose an in-flight turn after switching sessions', async () => {
    let resolveTurn: ((turn: GroundedChatTurnResponse) => void) | undefined
    sendStudentChatMessageMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTurn = resolve
        }),
    )
    const { queryClient, rerender } = renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture, secondSession],
        nextCursor: null,
      },
      messages: { messages: [], nextCursor: null },
    })

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled(),
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Question scoped to the first session' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(
      await screen.findByRole('status', {
        name: STUDENT_CHAT_GENERATION_STATUS,
      }),
    ).toBeInTheDocument()

    queryClient.setQueryData(
      studentSessionKeys.detail({
        studentId,
        courseId: primaryCourse.id,
        sessionId: secondSession.id,
      }),
      secondSession,
    )
    queryClient.setQueryData(
      studentSessionKeys.messageList({
        studentId,
        courseId: primaryCourse.id,
        sessionId: secondSession.id,
      }),
      {
        pages: [{ messages: [], nextCursor: null }],
        pageParams: [undefined],
      },
    )
    rerender(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system" storageKey="test-theme">
          <StudentAiTutorPage
            courseId={primaryCourse.id}
            sessionId={secondSession.id}
          />
        </ThemeProvider>
      </QueryClientProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: secondSession.title }),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled()
    expect(
      screen.queryByRole('status', {
        name: STUDENT_CHAT_GENERATION_STATUS,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Question scoped to the first session'),
    ).not.toBeInTheDocument()

    if (!resolveTurn) {
      throw new Error('Expected the first session turn to remain in flight')
    }
    await act(async () => resolveTurn?.(groundedChatTurnResponseFixture))
    expect(
      screen.getByRole('heading', { name: secondSession.title }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        groundedChatTurnResponseFixture.assistantMessage.content,
      ),
    ).not.toBeInTheDocument()
  })

  it('clears a failed send and retained draft when switching courses', async () => {
    sendStudentChatMessageMock.mockRejectedValueOnce(
      new TypeError('Failed to fetch'),
    )
    const otherCourseSession = {
      ...secondSession,
      courseId: otherCourse.id,
      title: 'JavaScript functions',
    }
    const { queryClient, rerender } = renderWorkspace({
      courses: [primaryCourse, otherCourse],
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: { messages: [], nextCursor: null },
    })

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled(),
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Failed Python question' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(
      await screen.findByText(/message could not be sent/i),
    ).toBeInTheDocument()

    queryClient.setQueryData(
      studentSessionKeys.sessionList({
        studentId,
        courseId: otherCourse.id,
      }),
      {
        pages: [{ sessions: [otherCourseSession], nextCursor: null }],
        pageParams: [undefined],
      },
    )
    queryClient.setQueryData(
      studentSessionKeys.detail({
        studentId,
        courseId: otherCourse.id,
        sessionId: otherCourseSession.id,
      }),
      otherCourseSession,
    )
    queryClient.setQueryData(
      studentSessionKeys.messageList({
        studentId,
        courseId: otherCourse.id,
        sessionId: otherCourseSession.id,
      }),
      {
        pages: [{ messages: [], nextCursor: null }],
        pageParams: [undefined],
      },
    )
    rerender(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system" storageKey="test-theme">
          <StudentAiTutorPage
            courseId={otherCourse.id}
            sessionId={otherCourseSession.id}
          />
        </ThemeProvider>
      </QueryClientProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: otherCourseSession.title }),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('')
    expect(screen.queryByText(/message could not be sent/i)).toBeNull()
  })

  it('does not carry an unsent draft into another Student cache partition', async () => {
    const otherStudentId = 'other-student-user'
    const { queryClient } = renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: { messages: [], nextCursor: null },
    })

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled(),
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Private draft for the first Student' },
    })

    queryClient.setQueryData(
      studentCoursesQueryOptions(otherStudentId).queryKey,
      [primaryCourse],
    )
    queryClient.setQueryData(
      studentSessionKeys.sessionList({
        studentId: otherStudentId,
        courseId: primaryCourse.id,
      }),
      {
        pages: [{ sessions: [primaryChatSessionFixture], nextCursor: null }],
        pageParams: [undefined],
      },
    )
    queryClient.setQueryData(
      studentSessionKeys.detail({
        studentId: otherStudentId,
        courseId: primaryCourse.id,
        sessionId: primaryChatSessionFixture.id,
      }),
      primaryChatSessionFixture,
    )
    queryClient.setQueryData(
      studentSessionKeys.messageList({
        studentId: otherStudentId,
        courseId: primaryCourse.id,
        sessionId: primaryChatSessionFixture.id,
      }),
      {
        pages: [{ messages: [], nextCursor: null }],
        pageParams: [undefined],
      },
    )
    act(() => {
      useAuthStore
        .getState()
        .setSession(createStudentAuthSession(otherStudentId))
    })

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue(''),
    )
    expect(
      screen.queryByDisplayValue('Private draft for the first Student'),
    ).not.toBeInTheDocument()
  })

  it('renders guidance, inline citations, and collapsible source evidence', async () => {
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: orderedMessageHistory,
    })

    expect(
      await screen.findByText('Course-grounded guidance'),
    ).toBeInTheDocument()
    expect(screen.getByText('[Python lists, chunk 1]')).toBeInTheDocument()

    fireEvent.click(
      await screen.findByRole(
        'button',
        { name: 'Sources (1)' },
        { timeout: 5_000 },
      ),
    )

    const responseSources = screen.getByRole('list', {
      name: 'Response sources',
    })
    expect(
      await within(responseSources).findByText(
        'Python lists are ordered and mutable collections.',
      ),
    ).toBeInTheDocument()
    expect(within(responseSources).getByText('Available')).toBeInTheDocument()
    expect(within(responseSources).getByText('Chunk 1')).toBeInTheDocument()
  })

  it('does not expose excluded review-workflow labels', async () => {
    const firstStudent = groundedChatTurnResponseFixture.studentMessage
    const firstAssistant = {
      ...groundedChatTurnResponseFixture.assistantMessage,
      guidanceLabel: 'UNCERTAIN_AWAITING_REVIEW' as const,
    }
    const secondStudent = {
      ...firstStudent,
      id: '11111111-1111-4111-8111-111111111111',
      sequence: 3,
      content: 'A second question',
    }
    const secondAssistant = {
      ...firstAssistant,
      id: '22222222-2222-4222-8222-222222222222',
      sequence: 4,
      responseToMessageId: secondStudent.id,
      guidanceLabel: 'INSTRUCTOR_REVIEWED' as const,
      content: 'A second answer',
    }
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: {
        messages: [
          firstStudent,
          firstAssistant,
          secondStudent,
          secondAssistant,
        ],
        nextCursor: null,
      },
    })

    expect(await screen.findByText(firstAssistant.content)).toBeInTheDocument()
    expect(screen.getByText(secondAssistant.content)).toBeInTheDocument()
    expect(screen.queryByText('Awaiting review')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Instructor-reviewed guidance'),
    ).not.toBeInTheDocument()
  })

  it('shows unavailable sources and no-evidence responses without invented metadata', async () => {
    const unavailableAssistant = {
      ...groundedChatTurnResponseFixture.assistantMessage,
      citations: [
        {
          ...groundedChatTurnResponseFixture.assistantMessage.citations[0],
          sourceAvailable: false,
          evidence: [],
        },
      ],
    }
    const unavailableHistory: ChatMessageHistoryResponse = {
      messages: [
        groundedChatTurnResponseFixture.studentMessage,
        unavailableAssistant,
      ],
      nextCursor: null,
    }
    const { queryClient } = renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: unavailableHistory,
    })

    fireEvent.click(
      await screen.findByRole(
        'button',
        { name: 'Sources (1)' },
        { timeout: 5_000 },
      ),
    )
    expect(await screen.findByText('Unavailable')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This source is no longer available. No excerpt is shown.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/page \d/i)).not.toBeInTheDocument()

    const blockedAssistant = {
      ...groundedChatTurnResponseFixture.assistantMessage,
      content: 'I could not find enough course evidence for that question.',
      status: 'BLOCKED' as const,
      guidanceLabel: 'GENERAL_NOT_FOUND' as const,
      errorCode: 'GROUNDING_INSUFFICIENT_EVIDENCE',
      citations: [],
    }
    queryClient.setQueryData(
      studentSessionKeys.messageList({
        studentId,
        courseId: primaryCourse.id,
        sessionId: primaryChatSessionFixture.id,
      }),
      {
        pages: [
          {
            messages: [
              groundedChatTurnResponseFixture.studentMessage,
              blockedAssistant,
            ],
            nextCursor: null,
          },
        ],
        pageParams: [undefined],
      },
    )

    expect(
      await screen.findByText('Course evidence not found'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No supporting course sources were found.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Sources \(/i })).toBeNull()
  })

  it('retries a failed persisted response without duplicating either message', async () => {
    const failedTurn = failedGroundedTurn()
    let resolveRetry: ((turn: GroundedChatTurnResponse) => void) | undefined
    retryStudentChatMessageMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRetry = resolve
        }),
    )
    getStudentSessionMessagesMock.mockResolvedValueOnce(orderedMessageHistory)
    renderWorkspace({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
      messages: {
        messages: [failedTurn.studentMessage, failedTurn.assistantMessage],
        nextCursor: null,
      },
    })

    expect(
      await screen.findByText(
        'The grounded response failed. Your question is saved and can be retried without creating another message.',
        {},
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry response' }))

    expect(await screen.findByLabelText('Message')).toBeDisabled()
    expect(retryStudentChatMessageMock).toHaveBeenCalledWith({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      studentMessageId: failedTurn.studentMessage.id,
    })

    const completeRetry = resolveRetry
    if (!completeRetry) {
      throw new Error('Expected a pending grounded response retry')
    }

    await act(async () => completeRetry(groundedChatTurnResponseFixture))

    expect(
      await screen.findByText(
        groundedChatTurnResponseFixture.assistantMessage.content,
      ),
    ).toBeInTheDocument()
    expect(
      screen
        .getByRole('list', { name: 'Conversation history' })
        .querySelectorAll(':scope > li'),
    ).toHaveLength(2)
    expect(screen.queryByText(/grounded response failed/i)).toBeNull()
  })
})
