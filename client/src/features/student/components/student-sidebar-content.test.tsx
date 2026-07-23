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

import { SidebarProvider } from '@/components/ui/sidebar'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/schemas/auth.schema'
import { ThemeProvider } from '@/providers/theme-provider'
import {
  createStudentSession,
  deleteStudentSession,
  getStudentSession,
  listStudentSessions,
  renameStudentSession,
} from '@/features/student/data/student-sessions.api'
import { studentCoursesQueryOptions } from '@/features/student/data/student-courses.queries'
import { studentSessionKeys } from '@/features/student/data/student-sessions.queries'
import type {
  ChatSession,
  ChatSessionListResponse,
} from '@/features/student/schemas/student-chat.schema'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'
import {
  primaryChatSessionFixture,
  studentChatIds,
} from '@/features/student/testing/student-chat.fixtures'

import { StudentSidebarContent } from './student-sidebar-content'

vi.mock('@/features/student/data/student-sessions.api')

const navigateMock = vi.hoisted(() => vi.fn())
const routerMockState = vi.hoisted<{
  search: { courseId?: string; sessionId?: string }
  pathname: string
}>(() => ({
  search: {},
  pathname: '/chat',
}))

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
  useRouterState: <T,>({
    select,
  }: {
    select: (state: {
      location: { pathname: string; search: Record<string, unknown> }
    }) => T
  }) =>
    select({
      location: {
        pathname: routerMockState.pathname,
        search: routerMockState.search,
      },
    }),
}))

const createStudentSessionMock = vi.mocked(createStudentSession)
const deleteStudentSessionMock = vi.mocked(deleteStudentSession)
const getStudentSessionMock = vi.mocked(getStudentSession)
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
const secondSession: ChatSession = {
  ...primaryChatSessionFixture,
  id: studentChatIds.otherSession,
  title: 'Functions practice',
}

function sessionAt(
  overrides: Partial<ChatSession> & { id: string; title: string },
): ChatSession {
  return { ...primaryChatSessionFixture, ...overrides }
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

function renderSidebar({
  courses = [primaryCourse],
  courseId = primaryCourse.id,
  sessionId,
  sessions,
  newChatButtonRef,
}: {
  courses?: StudentCourse[]
  courseId?: string
  sessionId?: string
  sessions?: ChatSessionListResponse
  newChatButtonRef?: { current: HTMLButtonElement | null }
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
  routerMockState.search = { courseId, sessionId }

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
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="test-theme">
        <SidebarProvider>
          <StudentSidebarContent newChatButtonRef={newChatButtonRef} />
        </SidebarProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

async function chooseSessionAction(
  sessionTitle: string,
  action: 'Rename' | 'Delete',
) {
  fireEvent.click(
    screen.getByRole('button', { name: `Open actions for ${sessionTitle}` }),
  )
  fireEvent.click(await screen.findByRole('menuitem', { name: action }))
}

describe('StudentSidebarContent', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    triggerSessionIntersection = undefined
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)
    listStudentSessionsMock.mockResolvedValue({
      sessions: [primaryChatSessionFixture],
      nextCursor: null,
    })
    getStudentSessionMock.mockImplementation(async ({ sessionId }) =>
      sessionId === secondSession.id
        ? secondSession
        : primaryChatSessionFixture,
    )
    routerMockState.search = { courseId: primaryCourse.id }
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

  it('groups conversations under recency headings', () => {
    const now = new Date()
    const daysAgo = (days: number) =>
      new Date(now.getTime() - days * 86_400_000).toISOString()

    renderSidebar({
      sessions: {
        sessions: [
          sessionAt({
            id: '11111111-1111-4111-8111-111111111111',
            title: 'Fresh today',
            lastMessageAt: now.toISOString(),
          }),
          sessionAt({
            id: '22222222-2222-4222-8222-222222222222',
            title: 'From yesterday',
            lastMessageAt: daysAgo(1),
          }),
          sessionAt({
            id: '33333333-3333-4333-8333-333333333333',
            title: 'Within the week',
            lastMessageAt: daysAgo(3),
          }),
          sessionAt({
            id: '44444444-4444-4444-8444-444444444444',
            title: 'Long ago',
            lastMessageAt: daysAgo(30),
          }),
        ],
        nextCursor: null,
      },
    })

    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
    expect(screen.getByText('Last 7 days')).toBeInTheDocument()
    expect(screen.getByText('Older')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Fresh today' }),
    ).toBeInTheDocument()
  })

  it('filters the loaded conversations with the search box', () => {
    renderSidebar({
      sessions: {
        sessions: [primaryChatSessionFixture, secondSession],
        nextCursor: null,
      },
    })

    expect(
      screen.getByRole('link', { name: /python lists/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /functions practice/i }),
    ).toBeInTheDocument()

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search your chats' }),
      { target: { value: 'functions' } },
    )

    expect(
      screen.queryByRole('link', { name: /python lists/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /functions practice/i }),
    ).toBeInTheDocument()
  })

  it('marks the active conversation and links to the chat route', () => {
    renderSidebar({
      sessionId: secondSession.id,
      sessions: {
        sessions: [primaryChatSessionFixture, secondSession],
        nextCursor: null,
      },
    })

    const selectedLink = screen.getByRole('link', {
      name: /functions practice/i,
    })
    expect(selectedLink).toHaveAttribute('aria-current', 'page')
    expect(selectedLink).toHaveAttribute(
      'href',
      `/chat?courseId=${primaryCourse.id}&sessionId=${secondSession.id}`,
    )
  })

  it('creates a new conversation and routes to it', async () => {
    createStudentSessionMock.mockResolvedValueOnce(primaryChatSessionFixture)
    listStudentSessionsMock.mockResolvedValueOnce({
      sessions: [primaryChatSessionFixture],
      nextCursor: null,
    })
    renderSidebar({
      sessions: { sessions: [], nextCursor: null },
    })

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/chat',
        search: {
          courseId: primaryCourse.id,
          sessionId: primaryChatSessionFixture.id,
        },
      }),
    )
  })

  it('surfaces a failed conversation creation', async () => {
    createStudentSessionMock.mockRejectedValueOnce(new Error('Create failed'))
    renderSidebar({
      sessions: { sessions: [], nextCursor: null },
    })

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Create failed')
  })

  const emptySelectedSession = sessionAt({
    id: '55555555-5555-4555-8555-555555555555',
    title: 'Empty selected draft',
    lastMessageAt: null,
  })
  const emptyOtherSession = sessionAt({
    id: '66666666-6666-4666-8666-666666666666',
    title: 'Empty other draft',
    lastMessageAt: null,
    createdAt: '2026-07-18T12:00:00.000Z',
    updatedAt: '2026-07-18T12:00:00.000Z',
  })

  it('does not create when the selected session is already empty', async () => {
    getStudentSessionMock.mockResolvedValue(emptySelectedSession)
    renderSidebar({
      sessionId: emptySelectedSession.id,
      sessions: { sessions: [emptySelectedSession], nextCursor: null },
    })

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))

    await Promise.resolve()
    expect(createStudentSessionMock).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('reuses the newest empty session instead of creating another', async () => {
    renderSidebar({
      sessionId: primaryChatSessionFixture.id,
      sessions: {
        sessions: [primaryChatSessionFixture, emptyOtherSession],
        nextCursor: null,
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/chat',
        search: {
          courseId: primaryCourse.id,
          sessionId: emptyOtherSession.id,
        },
      }),
    )
    expect(createStudentSessionMock).not.toHaveBeenCalled()
  })

  it('creates when no empty session is at hand', async () => {
    createStudentSessionMock.mockResolvedValueOnce(primaryChatSessionFixture)
    renderSidebar({
      sessions: {
        sessions: [
          { ...secondSession, lastMessageAt: '2026-07-17T09:02:00.000Z' },
        ],
        nextCursor: null,
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))

    await waitFor(() =>
      expect(createStudentSessionMock).toHaveBeenCalledTimes(1),
    )
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/chat',
      search: {
        courseId: primaryCourse.id,
        sessionId: primaryChatSessionFixture.id,
      },
    })
  })

  it('applies the same guard to the collapsed-cluster plus button', async () => {
    getStudentSessionMock.mockResolvedValue(emptySelectedSession)
    const newChatButtonRef: { current: HTMLButtonElement | null } = {
      current: null,
    }
    renderSidebar({
      sessionId: emptySelectedSession.id,
      sessions: { sessions: [emptySelectedSession], nextCursor: null },
      newChatButtonRef,
    })

    // The collapsed cluster's plus button forwards to this same button ref.
    expect(newChatButtonRef.current).not.toBeNull()
    fireEvent.click(newChatButtonRef.current!)

    await Promise.resolve()
    expect(createStudentSessionMock).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('validates and renames a conversation in the scoped list', async () => {
    const renamedSession = {
      ...primaryChatSessionFixture,
      title: 'Renamed Python chat',
    }
    renameStudentSessionMock.mockResolvedValueOnce(renamedSession)
    renderSidebar({
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
  })

  it('re-enables rename after a failed request so the Student can retry', async () => {
    const renamedSession = {
      ...primaryChatSessionFixture,
      title: 'Retry rename',
    }
    renameStudentSessionMock.mockRejectedValueOnce(new Error('Rename failed'))
    renameStudentSessionMock.mockResolvedValueOnce(renamedSession)
    renderSidebar({
      sessions: {
        sessions: [primaryChatSessionFixture],
        nextCursor: null,
      },
    })

    await chooseSessionAction(primaryChatSessionFixture.title, 'Rename')
    const titleInput = screen.getByRole('textbox', {
      name: `Rename ${primaryChatSessionFixture.title}`,
    })
    fireEvent.change(titleInput, { target: { value: renamedSession.title } })
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
    renderSidebar({
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

    resolveRename?.({ ...primaryChatSessionFixture, title: 'Pending rename' })
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: `Open actions for ${secondSession.title}`,
        }),
      ).toBeEnabled(),
    )
  })

  it('cancels inline rename with Escape without mutating the session', async () => {
    renderSidebar({
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
    routerMockState.search = {
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
    }
    renderSidebar({
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
      to: '/chat',
      search: { courseId: primaryCourse.id },
    })
  })

  it('keeps the delete confirmation open when the server rejects deletion', async () => {
    deleteStudentSessionMock.mockRejectedValueOnce(new Error('Delete failed'))
    renderSidebar({
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

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(deleteStudentSessionMock).toHaveBeenCalledTimes(2),
    )
  })

  it('loads additional session pages while scrolling inside the selected course', async () => {
    listStudentSessionsMock.mockReset()
    listStudentSessionsMock.mockResolvedValueOnce({
      sessions: [{ ...primaryChatSessionFixture }],
      nextCursor: primaryChatSessionFixture.id,
    })
    listStudentSessionsMock.mockResolvedValueOnce({
      sessions: [secondSession],
      nextCursor: null,
    })
    renderSidebar()

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

  it('shows loading and supports retry after a session-list failure', async () => {
    listStudentSessionsMock.mockReset()
    listStudentSessionsMock.mockRejectedValueOnce(new Error('Network failure'))
    listStudentSessionsMock.mockResolvedValueOnce({
      sessions: [],
      nextCursor: null,
    })
    renderSidebar()

    expect(
      screen.getByRole('status', { name: 'Loading conversations' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Sessions unavailable')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() =>
      expect(screen.getByText('No conversations yet.')).toBeInTheDocument(),
    )
    expect(listStudentSessionsMock).toHaveBeenCalledTimes(2)
  })
})
