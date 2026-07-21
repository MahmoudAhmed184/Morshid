import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/types/auth.types'
import { instructorCoursesQueryOptions } from '@/features/instructor/data/instructor-dashboard.queries'
import { MaterialsPage } from './materials-page'
import { ReviewQueuePage } from './review-queue-page'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Link: ({
    to,
    children,
    ...props
  }: {
    to?: string
    children?: React.ReactNode
  }) => (
    <a href={typeof to === 'string' ? to : '#'} {...props}>
      {children}
    </a>
  ),
}))

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

function renderInstructorPage(
  ui: React.ReactElement,
  {
    session = instructorSession,
    courses = session.user.courses.map(({ id, code, title }) => ({
      id,
      code,
      title,
    })),
    deferCourses = false,
  }: {
    session?: AuthSession
    courses?: { id: string; code: string; title: string }[]
    deferCourses?: boolean
  } = {},
) {
  setInstructorSession(session)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })

  if (deferCourses) {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    )
  } else {
    queryClient.setQueryData(
      instructorCoursesQueryOptions(session.user.id).queryKey,
      courses,
    )
  }

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
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
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('MaterialsPage', () => {
    it('renders the materials placeholder', () => {
      renderInstructorPage(<MaterialsPage />)

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

    it('keeps materials chrome and streams list skeletons while loading', () => {
      renderInstructorPage(<MaterialsPage />, { deferCourses: true })

      expect(
        screen.getAllByRole('heading', { name: 'Materials' }).length,
      ).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Course Materials')).toBeVisible()
      expect(
        screen.getByRole('status', { name: 'Loading materials' }),
      ).toBeVisible()
      expect(
        screen.queryByText('Materials are not connected yet'),
      ).not.toBeInTheDocument()
    })
  })

  describe('ReviewQueuePage', () => {
    it('renders the review queue placeholder', () => {
      renderInstructorPage(<ReviewQueuePage />)

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

    it('keeps review queue chrome and streams list skeletons while loading', () => {
      renderInstructorPage(<ReviewQueuePage />, { deferCourses: true })

      expect(
        screen.getAllByRole('heading', { name: 'Review Queue' }).length,
      ).toBeGreaterThanOrEqual(1)
      expect(
        screen.getByRole('status', { name: 'Loading review queue' }),
      ).toBeVisible()
      expect(
        screen.queryByText('No review requests yet'),
      ).not.toBeInTheDocument()
    })
  })
})
