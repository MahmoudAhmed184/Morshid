import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '@/features/auth/session/session.schema'
import { useAuthStore } from '@/features/auth/session/session.store'
import { rejectReviewCase, resolveReviewCase } from './instructor-reviews.api'
import { instructorReviewKeys } from './instructor-reviews.queries'

import {
  useRejectInstructorReview,
  useResolveInstructorReview,
} from './use-instructor-reviews'

vi.mock('./instructor-reviews.api')

const resolveReviewCaseMock = vi.mocked(resolveReviewCase)
const rejectReviewCaseMock = vi.mocked(rejectReviewCase)
const instructorId = '20000000-0000-4000-8000-000000000001'
const reviewCaseId = '10000000-0000-4000-8000-000000000001'
const otherReviewCaseId = '10000000-0000-4000-8000-000000000002'
const session: AuthSession = {
  user: {
    id: instructorId,
    email: 'instructor@morshid.demo',
    displayName: 'Instructor',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
  },
  tokenType: 'Bearer',
  accessToken: 'access-token',
  accessTokenExpiresAt: '2027-07-31T10:00:00.000Z',
}

describe('Instructor review action hooks', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    window.localStorage.clear()
    useAuthStore.getState().setSession(session)
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
  })

  it('resolves a review and invalidates its detail and the queue', async () => {
    const queryClient = createQueryClient()
    seedReviewQueries(queryClient)
    resolveReviewCaseMock.mockResolvedValue(
      actionResponse('RESOLVED', 'EDITED'),
    )
    const { result } = renderHook(() => useResolveInstructorReview(), {
      wrapper: createWrapper(queryClient),
    })

    await act(() =>
      result.current.mutateAsync({
        reviewCaseId,
        idempotencyKey: 'resolve-key',
        request: {
          expectedVersion: 2,
          outcome: 'EDITED',
          content: 'Reviewed guidance',
        },
      }),
    )

    expect(resolveReviewCaseMock).toHaveBeenCalledWith(
      reviewCaseId,
      {
        expectedVersion: 2,
        outcome: 'EDITED',
        content: 'Reviewed guidance',
      },
      'resolve-key',
    )
    expectInvalidation(queryClient)
  })

  it('rejects a review and invalidates its detail and the queue', async () => {
    const queryClient = createQueryClient()
    seedReviewQueries(queryClient)
    rejectReviewCaseMock.mockResolvedValue(
      actionResponse('REJECTED', 'REQUEST_REJECTED'),
    )
    const { result } = renderHook(() => useRejectInstructorReview(), {
      wrapper: createWrapper(queryClient),
    })

    await act(() =>
      result.current.mutateAsync({
        reviewCaseId,
        idempotencyKey: 'reject-key',
        request: { expectedVersion: 2, reason: 'Not applicable' },
      }),
    )

    expect(rejectReviewCaseMock).toHaveBeenCalledWith(
      reviewCaseId,
      { expectedVersion: 2, reason: 'Not applicable' },
      'reject-key',
    )
    expectInvalidation(queryClient)
  })
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function seedReviewQueries(queryClient: QueryClient) {
  queryClient.setQueryData(
    instructorReviewKeys.detail(instructorId, reviewCaseId),
    {},
  )
  queryClient.setQueryData(instructorReviewKeys.queue(instructorId), {})
  queryClient.setQueryData(
    instructorReviewKeys.detail(instructorId, otherReviewCaseId),
    {},
  )
}

function expectInvalidation(queryClient: QueryClient) {
  expect(
    queryClient.getQueryState(
      instructorReviewKeys.detail(instructorId, reviewCaseId),
    )?.isInvalidated,
  ).toBe(true)
  expect(
    queryClient.getQueryState(instructorReviewKeys.queue(instructorId))
      ?.isInvalidated,
  ).toBe(true)
  expect(
    queryClient.getQueryState(
      instructorReviewKeys.detail(instructorId, otherReviewCaseId),
    )?.isInvalidated,
  ).toBe(false)
}

function actionResponse(
  status: 'RESOLVED' | 'REJECTED',
  outcome: 'EDITED' | 'REQUEST_REJECTED',
) {
  return {
    reviewCaseId,
    status,
    outcome,
    publishedContent: status === 'RESOLVED' ? 'Reviewed guidance' : null,
    resolutionReason: null,
    version: 3,
    resolvedAt: '2026-07-31T10:00:00.000Z',
    replayed: false,
  } as const
}
