import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/types/auth.types'
import { InstructorDashboardPage } from './instructor-dashboard-page'

const instructorSession: AuthSession = {
  user: {
    id: 'instructor-user',
    email: 'instructor@morshid.demo',
    displayName: 'P0 Demo Instructor',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    courses: [
      {
        id: 'python-course',
        code: 'PYTHON-PROG-P0',
        title: 'Python Programming',
        membershipRole: 'INSTRUCTOR',
      },
    ],
  },
  tokenType: 'Bearer',
  accessToken: 'mock-access-token:instructor-user',
  accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
  refreshToken: 'mock-refresh-token:instructor-user',
  refreshTokenExpiresAt: '2026-07-18T12:00:00.000Z',
}

function setInstructorSession(session: AuthSession = instructorSession) {
  useAuthStore.getState().setSession(session)
}

function renderWithLayout(ui: React.ReactElement) {
  return render(ui)
}

describe('InstructorDashboardPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })

  it('renders the instructor dashboard shell', () => {
    setInstructorSession()

    renderWithLayout(<InstructorDashboardPage />)

    expect(
      screen.getByRole('heading', { name: 'Instructor Dashboard' }),
    ).toBeInTheDocument()
  })

  it('shows the Python Programming course from auth state', () => {
    setInstructorSession()

    renderWithLayout(<InstructorDashboardPage />)

    expect(
      screen.getByRole('heading', { name: 'Python Programming' }),
    ).toBeInTheDocument()
    expect(screen.getByText('PYTHON-PROG-P0')).toBeInTheDocument()
    expect(screen.getByText('0 Pending')).toBeInTheDocument()
  })

  it('handles an instructor auth session without assigned courses', () => {
    setInstructorSession({
      ...instructorSession,
      user: {
        ...instructorSession.user,
        courses: [],
      },
    })

    renderWithLayout(<InstructorDashboardPage />)

    expect(
      screen.getByRole('heading', { name: 'No assigned courses' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Python Programming')).not.toBeInTheDocument()
  })
})
