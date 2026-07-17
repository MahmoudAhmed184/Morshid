import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/features/auth/schemas/auth.schema'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  createStudentSession,
  deleteStudentSession,
  listStudentSessions,
  renameStudentSession,
} from '@/features/student/data/student-sessions.api'
import { studentCoursesQueryOptions } from '@/features/student/data/student-courses.queries'
import { studentSessionKeys } from '@/features/student/data/student-sessions.queries'
import type { ChatSessionListResponse } from '@/features/student/schemas/student-chat.schema'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'
import {
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
const listStudentSessionsMock = vi.mocked(listStudentSessions)
const renameStudentSessionMock = vi.mocked(renameStudentSession)
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
}: {
  courses?: StudentCourse[]
  courseId?: string
  sessionId?: string
  sessions?: ChatSessionListResponse
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
      sessions,
    )
  } else if (courses.length === 1 && sessions) {
    queryClient.setQueryData(
      studentSessionKeys.sessionList({
        studentId,
        courseId: courses[0]?.id ?? 'missing-course',
      }),
      sessions,
    )
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <StudentAiTutorPage courseId={courseId} sessionId={sessionId} />
    </QueryClientProvider>,
  )
}

describe('StudentAiTutorPage workspace', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
    useAuthStore.getState().setSession(createStudentAuthSession())
  })

  afterEach(() => {
    cleanup()
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

  it('creates and selects a new conversation with pending and retry states', async () => {
    let rejectCreate: ((error: Error) => void) | undefined
    createStudentSessionMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectCreate = reject
        }),
    )
    renderWorkspace({
      courseId: primaryCourse.id,
      sessions: { sessions: [], nextCursor: null },
    })

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(
      await screen.findByRole('button', { name: 'Creating...' }),
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

    fireEvent.click(
      screen.getByRole('button', {
        name: `Rename ${primaryChatSessionFixture.title}`,
      }),
    )
    const titleInput = screen.getByLabelText('Conversation title')
    const saveButton = screen.getByRole('button', { name: 'Save title' })

    expect(saveButton).toBeDisabled()
    fireEvent.change(titleInput, { target: { value: '   ' } })
    expect(saveButton).toBeDisabled()
    fireEvent.change(titleInput, { target: { value: renamedSession.title } })
    fireEvent.click(saveButton)

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

    fireEvent.click(
      screen.getByRole('button', {
        name: `Delete ${primaryChatSessionFixture.title}`,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(deleteStudentSessionMock).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', {
        name: `Delete ${primaryChatSessionFixture.title}`,
      }),
    )
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

    fireEvent.click(
      screen.getByRole('button', {
        name: `Delete ${primaryChatSessionFixture.title}`,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Delete failed')
    expect(
      screen.getByRole('heading', { name: 'Delete conversation?' }),
    ).toBeInTheDocument()
  })
})
