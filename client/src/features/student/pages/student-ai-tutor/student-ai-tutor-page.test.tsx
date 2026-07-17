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
import { listStudentSessions } from '@/features/student/data/student-sessions.api'
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
}))

const listStudentSessionsMock = vi.mocked(listStudentSessions)
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

function createStudentSession(): AuthSession {
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
    useAuthStore.getState().setSession(createStudentSession())
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
})
