import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/types/auth.types'
import { instructorCoursesQueryOptions } from '@/features/instructor/data/instructor-dashboard.queries'

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

function renderReviewQueue({ deferCourses = false } = {}) {
  useAuthStore.getState().setSession(instructorSession)

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
      instructorCoursesQueryOptions(instructorSession.user.id).queryKey,
      [
        {
          id: 'python-course',
          code: 'PYTHON-PROG-P0',
          title: 'Python Programming',
          membershipRole: 'INSTRUCTOR',
          canManageMaterials: true,
        },
      ],
    )
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <ReviewQueuePage />
    </QueryClientProvider>,
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

  it('renders the review queue empty state', () => {
    renderReviewQueue()

    expect(
      screen.getAllByRole('heading', { name: 'Review Queue' }).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('No review requests yet')).toBeInTheDocument()
  })

  it('keeps review queue chrome visible while courses load', () => {
    renderReviewQueue({ deferCourses: true })

    expect(
      screen.getAllByRole('heading', { name: 'Review Queue' }).length,
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByRole('status', { name: 'Loading review queue' }),
    ).toBeVisible()
    expect(screen.queryByText('No review requests yet')).not.toBeInTheDocument()
  })
})
