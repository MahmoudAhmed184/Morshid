import '@testing-library/jest-dom/vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { requestStudentReview } from '@/features/reviews/student-inbox/student-reviews.api'
import { allowancesKeys } from '@/features/allowances/interface'
import type { StudentAllowance } from '@/features/allowances/interface'
import { useStudentReviewRequest } from './use-review-request'

vi.mock('@/features/reviews/student-inbox/student-reviews.api')

const requestStudentReviewMock = vi.mocked(requestStudentReview)
const studentId = 'test-student-id'
const courseId = 'test-course-id'
const sessionId = 'test-session-id'

describe('useStudentReviewRequest', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.resetAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    useAuthStore.getState().setSession({
      tokenType: 'Bearer',
      user: {
        id: studentId,
        email: 'test@morshid.test',
        displayName: 'Test Student',
        role: 'STUDENT',
        status: 'ACTIVE',
      },
      accessToken: 'test-token',
      accessTokenExpiresAt: '2027-01-01T00:00:00.000Z',
    })
  })

  it('updates and decrements review allowance immediately on successful flag request', async () => {
    const initialAllowance: StudentAllowance = {
      used: 1,
      limit: 3,
      remaining: 2,
      resetAt: '2026-08-21T00:00:00.000Z',
      policyTimeZone: 'Africa/Cairo',
      scope: 'REVIEW',
      policyDayWindow: undefined,
    }

    queryClient.setQueryData(allowancesKeys.reviews(courseId), initialAllowance)

    requestStudentReviewMock.mockResolvedValueOnce({
      caseId: '11111111-1111-4111-8111-111111111111',
      messageId: '22222222-2222-4222-8222-222222222222',
      status: 'PENDING',
      trigger: 'STUDENT_REQUEST',
      requestedAt: '2026-08-20T12:00:00.000Z',
      replayed: false,
      reviewSummary: {
        status: 'PENDING',
        outcome: null,
        resolvedAt: null,
        reviewCaseId: '11111111-1111-4111-8111-111111111111',
      },
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(
      () => useStudentReviewRequest({ courseId, sessionId }),
      { wrapper },
    )

    await act(async () => {
      await result.current.mutateAsync({
        messageId: 'msg-1',
        flagReason: 'INCORRECT',
        note: 'Please check this explanation',
      })
    })

    const updatedAllowance = queryClient.getQueryData<StudentAllowance>(
      allowancesKeys.reviews(courseId),
    )

    expect(updatedAllowance).toEqual({
      ...initialAllowance,
      used: 2,
      remaining: 1,
    })
  })
})
