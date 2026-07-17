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
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'

import { StudentAiTutorPage } from './student-ai-tutor-page'
import { StudentCoursesPage } from './student-courses-page'
import { StudentDashboardPage } from './student-dashboard-page'
import { StudentShellPage } from './student-shell-page'

const routerMockState = vi.hoisted(() => ({
  hydrated: true,
  pathname: '/student/dashboard',
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
    select: (state: { location: { pathname: string } }) => T
  }) =>
    select({
      location: {
        pathname: routerMockState.pathname,
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
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  queryClient.setQueryData(
    studentCoursesQueryOptions('student-user').queryKey,
    courses,
  )

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

  it('renders assigned courses from the scoped course query', () => {
    const fetchMock = vi.fn()

    vi.stubGlobal('fetch', fetchMock)
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(<StudentShellPage />, [
      {
        id: 'python-course',
        code: 'PYTHON-PROG-P0',
        title: 'Python Programming',
        membershipRole: 'STUDENT',
      },
    ])

    const coursesList = screen.getByRole('list', {
      name: /assigned courses/i,
    })

    expect(coursesList).toBeInTheDocument()
    expect(
      within(coursesList).getByText('Python Programming'),
    ).toBeInTheDocument()
    expect(within(coursesList).getByText('PYTHON-PROG-P0')).toBeInTheDocument()
    expect(screen.queryByText('Instructor Only')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows an empty state when no courses are assigned', () => {
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(<StudentShellPage />)

    expect(screen.getByText('No courses assigned yet.')).toBeInTheDocument()
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
    expect(screen.getByRole('link', { name: /ai tutor/i })).toHaveAttribute(
      'href',
      '/student/ai-tutor',
    )
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
      within(drawer).getByRole('link', { name: /ai tutor/i }),
    ).toHaveAttribute('href', '/student/ai-tutor')
    expect(
      within(drawer).getByRole('link', { name: /settings/i }),
    ).toHaveAttribute('href', '/student/settings')
  })
})

describe('StudentAiTutorPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })

  it('renders the disconnected chat placeholder for the selected course context', () => {
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(<StudentAiTutorPage />, [
      {
        id: 'python-course',
        code: 'PYTHON-PROG-P0',
        title: 'Python Programming',
        membershipRole: 'STUDENT',
      },
    ])

    expect(
      screen.getByRole('heading', { name: 'Python Programming' }),
    ).toBeInTheDocument()
    expect(screen.getByText('PYTHON-PROG-P0')).toBeInTheDocument()
    expect(screen.getByText('Chat not connected')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'No conversation yet' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/course-grounded chat is not available yet/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toBeDisabled()
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
  })

  it('uses an explicit course id when multiple courses are assigned', () => {
    useAuthStore.getState().setSession(createStudentSession([]))

    renderWithStudentCourses(
      <StudentAiTutorPage courseId="javascript-course" />,
      [
        {
          id: 'python-course',
          code: 'PYTHON-PROG-P0',
          title: 'Python Programming',
          membershipRole: 'STUDENT',
        },
        {
          id: 'javascript-course',
          code: 'JAVASCRIPT-P0',
          title: 'JavaScript Programming',
          membershipRole: 'STUDENT',
        },
      ],
    )

    expect(
      screen.getByRole('heading', { name: 'JavaScript Programming' }),
    ).toBeInTheDocument()
    expect(screen.getByText('JAVASCRIPT-P0')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /python programming/i }),
    ).toHaveAttribute('href', '/student/ai-tutor?courseId=python-course')
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
