import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/types/auth.types'

import { StudentShellPage } from './student-shell-page'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
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

describe('StudentShellPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
    navigateMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    navigateMock.mockReset()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders assigned student courses from the authenticated user without fetching', () => {
    const fetchMock = vi.fn()

    vi.stubGlobal('fetch', fetchMock)
    useAuthStore.getState().setSession(
      createStudentSession([
        {
          id: 'python-course',
          code: 'PYTHON-PROG-P0',
          title: 'Python Programming',
          membershipRole: 'STUDENT',
        },
        {
          id: 'instructor-course',
          code: 'INSTRUCTOR-ONLY',
          title: 'Instructor Only',
          membershipRole: 'INSTRUCTOR',
        },
      ]),
    )

    render(<StudentShellPage />)

    expect(
      screen.getByRole('list', { name: /assigned courses/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Python Programming')).toBeInTheDocument()
    expect(screen.getByText('PYTHON-PROG-P0')).toBeInTheDocument()
    expect(screen.queryByText('Instructor Only')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows an empty state when no courses are assigned', () => {
    useAuthStore.getState().setSession(createStudentSession([]))

    render(<StudentShellPage />)

    expect(screen.getByText('No courses assigned yet.')).toBeInTheDocument()
  })
})
