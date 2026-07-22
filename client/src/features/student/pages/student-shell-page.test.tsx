import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/types/auth.types'
import { ThemeProvider } from '@/providers/theme-provider'
import { studentCoursesQueryOptions } from '@/features/student/data/student-courses.queries'
import { studentSessionKeys } from '@/features/student/data/student-sessions.queries'
import type { ChatSessionListResponse } from '@/features/student/schemas/student-chat.schema'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'

import { StudentCoursesPage } from './student-courses-page'
import { StudentShellPage } from './student-shell-page'

const routerMockState = vi.hoisted(() => ({
  hydrated: true,
  pathname: '/student/courses',
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
  ScriptOnce: () => null,
  useNavigate: () => () => Promise.resolve(),
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
    for (const session of sessionList.response.sessions) {
      queryClient.setQueryData(
        studentSessionKeys.detail({
          studentId: 'student-user',
          courseId: sessionList.courseId,
          sessionId: session.id,
        }),
        session,
      )
    }
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="test-theme">
        {ui}
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('StudentShellPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
    routerMockState.hydrated = true
    routerMockState.pathname = '/student/courses'
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

  it('wraps secondary pages in the slim top bar with a breadcrumb', () => {
    routerMockState.pathname = '/student/courses'
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(<StudentShellPage />)

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })

    expect(within(breadcrumb).getByText('Student')).toBeInTheDocument()
    expect(within(breadcrumb).getByText('The Shelf')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /return to the ai tutor workspace/i }),
    ).toHaveAttribute('href', '/student/ai-tutor')
    expect(screen.getByTestId('student-route-outlet')).toBeInTheDocument()
  })

  it('labels the settings breadcrumb', () => {
    routerMockState.pathname = '/student/settings'
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(<StudentShellPage />)

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })

    expect(within(breadcrumb).getByText('Settings')).toBeInTheDocument()
  })

  it('renders the workspace outlet without the secondary top bar', () => {
    routerMockState.pathname = '/student/ai-tutor'
    routerMockState.search = { courseId: 'course-id' }
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(<StudentShellPage />)

    expect(screen.getByTestId('student-route-outlet')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull()
    expect(
      screen.queryByRole('link', { name: /return to the ai tutor workspace/i }),
    ).toBeNull()
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

    expect(
      screen.getByRole('heading', { name: 'Your courses.' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Python Programming' }),
    ).toBeInTheDocument()
    expect(screen.getByText('PYTHON-PROG-P0')).toBeInTheDocument()
  })

  it('renders the empty assigned courses state', () => {
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(<StudentCoursesPage />)

    expect(
      screen.getByRole('heading', { name: 'Your courses.' }),
    ).toBeInTheDocument()
    expect(screen.getByText('No courses assigned yet.')).toBeInTheDocument()
  })
})
