import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/schemas/auth.schema'
import { studentCoursesQueryOptions } from '@/features/student/data/student-courses.queries'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'

import { StudentCoursesPage } from './student-courses-page'

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

function createStudentSession(): AuthSession {
  return {
    tokenType: 'Bearer',
    user: {
      id: 'student-user',
      email: 'student1@morshid.demo',
      displayName: 'Sara Demo',
      role: 'STUDENT',
      status: 'ACTIVE',
      courses: [],
    },
    accessToken: 'student-access-token',
    accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
    refreshToken: 'student-refresh-token',
    refreshTokenExpiresAt: '2026-07-18T12:00:00.000Z',
  }
}

function renderCoursesPage(courses: StudentCourse[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(
    studentCoursesQueryOptions('student-user').queryKey,
    courses,
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <StudentCoursesPage />
    </QueryClientProvider>,
  )
}

describe('StudentCoursesPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
    useAuthStore.getState().setSession(createStudentSession())
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })

  it('greets the student and lists course cards without codes', () => {
    renderCoursesPage([
      {
        id: 'python-course',
        code: 'PYTHON-PROG-P0',
        title: 'Python Programming',
        membershipRole: 'STUDENT',
      },
    ])

    expect(
      screen.getByRole('heading', { name: /, Sara\.$/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('Choose a course to continue.')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Python Programming' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /python programming/i }),
    ).toHaveAttribute('href', '/chat?courseId=python-course')
    expect(screen.queryByText('PYTHON-PROG-P0')).not.toBeInTheDocument()
  })

  it('renders the empty assigned courses state', () => {
    renderCoursesPage()

    expect(screen.getByText('No courses assigned yet.')).toBeInTheDocument()
  })
})
