import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/types/auth.types'
import { InstructorDashboardPage } from './instructor-dashboard-page'
import { MaterialsPage } from './materials-page'
import { MyCoursesPage } from './my-courses-page'
import { ReviewQueuePage } from './review-queue-page'

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

describe('Instructor Pages', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })

  describe('InstructorDashboardPage', () => {
    it('renders the instructor dashboard shell', () => {
      setInstructorSession()

      renderWithLayout(<InstructorDashboardPage />)

      expect(
        screen.getByRole('heading', { name: 'Instructor Dashboard' }),
      ).toBeInTheDocument()
    })

    it('shows the Python Programming course from auth state', () => {
      setInstructorSession()

      render(<InstructorDashboardPage />)

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

      render(<InstructorDashboardPage />)

      expect(
        screen.getByRole('heading', { name: 'No assigned courses' }),
      ).toBeInTheDocument()
      expect(screen.queryByText('Python Programming')).not.toBeInTheDocument()
    })
  })

  describe('MyCoursesPage', () => {
    it('displays the assigned instructor course', () => {
      setInstructorSession()

      renderWithLayout(<MyCoursesPage />)

      expect(
        screen.getByRole('heading', { name: 'My Courses' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: 'Python Programming' }),
      ).toBeInTheDocument()
      expect(screen.getByText('PYTHON-PROG-P0')).toBeInTheDocument()
      expect(screen.getByText('INSTRUCTOR')).toBeInTheDocument()
    })

    it('displays all assigned courses when multiple exist', () => {
      setInstructorSession({
        ...instructorSession,
        user: {
          ...instructorSession.user,
          courses: [
            {
              id: 'python-course',
              code: 'PYTHON-PROG-P0',
              title: 'Python Programming',
              membershipRole: 'INSTRUCTOR',
            },
            {
              id: 'data-structures-course',
              code: 'DATA-STRUCT-P0',
              title: 'Data Structures & Algorithms',
              membershipRole: 'INSTRUCTOR',
            },
          ],
        },
      })

      renderWithLayout(<MyCoursesPage />)

      expect(
        screen.getByRole('heading', { name: 'My Courses' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: 'Python Programming' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: 'Data Structures & Algorithms' }),
      ).toBeInTheDocument()
      expect(screen.getByText('PYTHON-PROG-P0')).toBeInTheDocument()
      expect(screen.getByText('DATA-STRUCT-P0')).toBeInTheDocument()
    })

    it('shows empty state when no courses are assigned', () => {
      setInstructorSession({
        ...instructorSession,
        user: {
          ...instructorSession.user,
          courses: [],
        },
      })

      renderWithLayout(<MyCoursesPage />)

      expect(
        screen.getByRole('heading', { name: 'No assigned courses' }),
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'This instructor account does not have a course assignment in the current auth session.',
        ),
      ).toBeInTheDocument()
    })
  })

  describe('MaterialsPage', () => {
    it('renders the materials placeholder', () => {
      setInstructorSession()

      renderWithLayout(<MaterialsPage />)

      const materialsHeadings = screen.getAllByRole('heading', {
        name: 'Materials',
      })
      expect(materialsHeadings.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Course Materials')).toBeInTheDocument()
      expect(
        screen.getByText('Materials are not connected yet'),
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'This panel is reserved for Sprint 2 upload, processing, and source readiness status.',
        ),
      ).toBeInTheDocument()
    })
  })

  describe('ReviewQueuePage', () => {
    it('renders the review queue placeholder', () => {
      setInstructorSession()

      renderWithLayout(<ReviewQueuePage />)

      const reviewQueueHeadings = screen.getAllByRole('heading', {
        name: 'Review Queue',
      })
      expect(reviewQueueHeadings.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('No review requests yet')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Flagged exchanges will appear here after the Sprint 3 review workflow is implemented.',
        ),
      ).toBeInTheDocument()
    })
  })
})
