import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/session/session.store'
import type { AuthSession } from '@/features/auth/session/session.schema'
import { instructorReviewQueueQueryOptions } from '@/features/instructor/data/instructor-reviews.queries'

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
  },
  tokenType: 'Bearer',
  accessToken: 'mock-access-token:instructor-user',
  accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
}

function renderReviewQueue({ deferReviews = false } = {}) {
  useAuthStore.getState().setSession(instructorSession)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })

  if (deferReviews) {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    )
  } else {
    queryClient.setQueryData(
      instructorReviewQueueQueryOptions(instructorSession.user.id).queryKey,
      {
        pages: [{ items: [], pendingCount: 0, nextCursor: null }],
        pageParams: [null],
      },
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
    expect(screen.getByText('No review requests')).toBeInTheDocument()
  })

  it('keeps review queue chrome visible while reviews load', () => {
    renderReviewQueue({ deferReviews: true })

    expect(
      screen.getAllByRole('heading', { name: 'Review Queue' }).length,
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByRole('status', { name: 'Loading review queue' }),
    ).toBeVisible()
    expect(screen.queryByText('No review requests')).not.toBeInTheDocument()
  })
})
