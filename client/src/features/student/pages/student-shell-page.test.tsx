import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/types/auth.types'
import { studentCoursesQueryOptions } from '@/features/student/data/student-courses.queries'
import { studentSessionKeys } from '@/features/student/data/student-sessions.queries'
import type { ChatSessionListResponse } from '@/features/student/schemas/student-chat.schema'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'

import { StudentCoursesPage } from './student-courses-page'
import { StudentDashboardPage } from './student-dashboard-page'
import { StudentShellPage } from './student-shell-page'

const routerMockState = vi.hoisted(() => ({
  hydrated: true,
  pathname: '/student/dashboard',
  search: {},
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
  Outlet: () => <div data-testid="student-route-outlet" />,
  useHydrated: () => routerMockState.hydrated,
  useRouterState: <T,>({
    select,
  }: {
    select: (state: {
      location: { pathname: string; search: Record<string, string> }
    }) => T
  }) =>
    select({
      location: {
        pathname: routerMockState.pathname,
        search: routerMockState.search,
      },
    }),
}))

function createStudentSession(
  courses: AuthSession['user']['courses'],
): AuthSession {
  return {
    tokenType: 'Bearer',
    user: {
      id: 'student-user',
      email: 'student1@morshid.demo',
      displayName: 'P0 Demo Student',
      role: 'STUDENT',
      status: 'ACTIVE',
      courses,
    },
    accessToken: 'student-access-token',
    accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
    refreshToken: 'student-refresh-token',
    refreshTokenExpiresAt: '2026-07-18T12:00:00.000Z',
  }
}

function renderWithStudentCourses(
  ui: React.ReactNode,
  courses: StudentCourse[] = [],
  sessionList?: {
    courseId: string
    response: ChatSessionListResponse
  },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  queryClient.setQueryData(
    studentCoursesQueryOptions('student-user').queryKey,
    courses,
  )
  if (sessionList) {
    queryClient.setQueryData(
      studentSessionKeys.sessionList({
        studentId: 'student-user',
        courseId: sessionList.courseId,
      }),
      { pages: [sessionList.response], pageParams: [undefined] },
    )
  }

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

describe('StudentShellPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
    routerMockState.hydrated = true
    routerMockState.pathname = '/student/dashboard'
    routerMockState.search = {}
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('matches the server authentication fallback before hydration', () => {
    routerMockState.hydrated = false

    renderWithStudentCourses(<StudentShellPage />)

    expect(
      screen.getByRole('status', { name: 'Checking authentication' }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('student-route-outlet')).toBeNull()
  })

  it('does not show assigned courses in the sidebar', () => {
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(<StudentShellPage />)

    const sidebar = screen.getByLabelText('Student navigation')

    expect(within(sidebar).queryByText('Assigned Courses')).toBeNull()
    expect(within(sidebar).queryByText('No courses assigned yet.')).toBeNull()
  })

  it('links sidebar navigation to the nested student routes', () => {
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(<StudentShellPage />)

    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute(
      'href',
      '/student/dashboard',
    )
    expect(screen.getByRole('link', { name: /courses/i })).toHaveAttribute(
      'href',
      '/student/courses',
    )
    expect(
      screen.queryByRole('link', { name: /ai tutor/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute(
      'href',
      '/student/settings',
    )
    expect(screen.getByTestId('student-route-outlet')).toBeInTheDocument()
  })

  it('reflects the active nested student route', () => {
    routerMockState.pathname = '/student/courses'
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(<StudentShellPage />)

    expect(screen.getByRole('link', { name: /courses/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.getByRole('link', { name: /dashboard/i }),
    ).not.toHaveAttribute('aria-current')
  })

  it('gives the AI Tutor its full-width session workspace', () => {
    const courseId = 'course-id'
    const sessionId = 'session-id'
    routerMockState.pathname = '/student/ai-tutor'
    routerMockState.search = { courseId, sessionId }
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(
      <StudentShellPage />,
      [
        {
          id: courseId,
          code: 'CS 214',
          title: 'Data Structures & Algorithms',
          membershipRole: 'STUDENT',
        },
      ],
      {
        courseId,
        response: {
          sessions: [
            {
              id: sessionId,
              courseId,
              title: 'Big-O of merge sort, step by step',
              lastMessageAt: null,
              createdAt: '2026-07-17T12:00:00.000Z',
              updatedAt: '2026-07-17T12:00:00.000Z',
            },
          ],
          nextCursor: null,
        },
      },
    )

    expect(screen.queryByLabelText('Student navigation')).toBeNull()
    expect(
      screen.queryByRole('button', { name: /open student navigation/i }),
    ).toBeNull()
    expect(screen.getByRole('link', { name: 'Courses' })).toHaveAttribute(
      'href',
      '/student/courses',
    )
    expect(
      within(screen.getByLabelText('Tutor breadcrumb')).getByText(
        'CS 214 · Big-O of merge sort, step by step',
      ),
    ).toBeInTheDocument()
    expect(screen.getByTestId('student-route-outlet')).toBeInTheDocument()
  })

  it('opens student navigation in the mobile drawer', () => {
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(<StudentShellPage />)

    fireEvent.click(
      screen.getByRole('button', { name: /open student navigation/i }),
    )

    const drawer = screen.getByRole('dialog', {
      name: /student navigation/i,
    })

    expect(
      within(drawer).getByRole('link', { name: /dashboard/i }),
    ).toHaveAttribute('href', '/student/dashboard')
    expect(
      within(drawer).getByRole('link', { name: /courses/i }),
    ).toHaveAttribute('href', '/student/courses')
    expect(
      within(drawer).queryByRole('link', { name: /ai tutor/i }),
    ).not.toBeInTheDocument()
    expect(
      within(drawer).getByRole('link', { name: /settings/i }),
    ).toHaveAttribute('href', '/student/settings')
  })
})

describe('StudentDashboardPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })

  it('renders the student dashboard summary', () => {
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(<StudentDashboardPage />, [
      {
        id: 'python-course',
        code: 'PYTHON-PROG-P0',
        title: 'Python Programming',
        membershipRole: 'STUDENT',
      },
    ])

    expect(
      screen.getByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Assigned courses')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Chat not connected')).toBeInTheDocument()
  })
})

describe('StudentCoursesPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })

  it('renders assigned courses without an unstable store selector', () => {
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(<StudentCoursesPage />, [
      {
        id: 'python-course',
        code: 'PYTHON-PROG-P0',
        title: 'Python Programming',
        membershipRole: 'STUDENT',
      },
    ])

    expect(screen.getByRole('heading', { name: 'Courses' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Python Programming' }),
    ).toBeInTheDocument()
    expect(screen.getByText('PYTHON-PROG-P0')).toBeInTheDocument()
  })

  it('renders the empty assigned courses state', () => {
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(<StudentCoursesPage />)

    expect(screen.getByRole('heading', { name: 'Courses' })).toBeInTheDocument()
    expect(screen.getByText('No courses assigned yet.')).toBeInTheDocument()
  })
})
