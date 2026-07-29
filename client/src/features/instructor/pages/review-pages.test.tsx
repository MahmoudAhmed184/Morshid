import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  useInstructorReviewDetail,
  useInstructorReviewQueue,
} from '@/features/instructor/hooks/use-instructor-reviews'

import { ReviewDetailPage } from './review-detail-page'
import { ReviewQueuePage } from './review-queue-page'

vi.mock('@/features/instructor/hooks/use-instructor-reviews')

const useQueueMock = vi.mocked(useInstructorReviewQueue)
const useDetailMock = vi.mocked(useInstructorReviewDetail)
const reviewCaseId = '10000000-0000-4000-8000-000000000001'
const courseId = '20000000-0000-4000-8000-000000000001'
const studentId = '30000000-0000-4000-8000-000000000001'
const materialId = '40000000-0000-4000-8000-000000000001'

function queryResult<T>(data: T, overrides: Record<string, unknown> = {}) {
  return {
    data,
    error: null,
    isError: false,
    isFetching: false,
    isPending: false,
    refetch: vi.fn(),
    ...overrides,
  }
}

describe('Instructor review pages', () => {
  beforeEach(() => vi.resetAllMocks())
  afterEach(() => cleanup())

  it('renders the server-ordered queue and pending count', () => {
    useQueueMock.mockReturnValue(queueQuery([queueItem()]))
    render(<ReviewQueuePage />)

    expect(screen.getByText('1 pending')).toBeVisible()
    expect(screen.getByText('Safe Student')).toBeVisible()
    expect(screen.getByText('Course One')).toBeVisible()
    expect(screen.getByText('Student request')).toBeVisible()
  })

  it('renders the queue loading state', () => {
    useQueueMock.mockReturnValue(
      queryResult(undefined, { isPending: true }) as unknown as ReturnType<
        typeof useInstructorReviewQueue
      >,
    )
    render(<ReviewQueuePage />)
    expect(
      screen.getByRole('status', { name: 'Loading review queue' }),
    ).toBeVisible()
  })

  it('renders the queue empty state', () => {
    useQueueMock.mockReturnValue(queueQuery([]))
    render(<ReviewQueuePage />)
    expect(
      screen.getByRole('heading', { name: 'No review requests' }),
    ).toBeVisible()
  })

  it('links each queue item to its detail route', () => {
    useQueueMock.mockReturnValue(queueQuery([queueItem()]))
    render(<ReviewQueuePage />)
    expect(screen.getByRole('link', { name: /Review/ })).toHaveAttribute(
      'href',
      `/instructor/review-queue/${reviewCaseId}`,
    )
  })

  it('renders bounded detail evidence and adjacent exchanges', () => {
    useDetailMock.mockReturnValue(
      queryResult(detail()) as unknown as ReturnType<
        typeof useInstructorReviewDetail
      >,
    )
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

    expect(screen.getByText('Flagged question')).toBeVisible()
    expect(screen.getByText('Flagged assistant answer')).toBeVisible()
    expect(screen.getByText('Please check the explanation.')).toBeVisible()
    expect(screen.getByText('Previous question')).toBeVisible()
    expect(screen.getByText('Previous answer')).toBeVisible()
    expect(screen.getByText('Following question')).toBeVisible()
    expect(screen.getByText('Following answer')).toBeVisible()
    expect(screen.getByText('Bounded citation snippet')).toBeVisible()
  })

  it('does not render non-contract private or unrelated data', () => {
    const response = {
      ...detail(),
      privateStudentEmail: 'private-student@example.test',
      internalMetadata: 'INTERNAL-SECRET',
      unrelatedConversation: 'UNRELATED-MESSAGE',
      fullDocument: 'PRIVATE-DOCUMENT-CONTENT',
    }
    useDetailMock.mockReturnValue(
      queryResult(response) as unknown as ReturnType<
        typeof useInstructorReviewDetail
      >,
    )
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

    expect(screen.queryByText('private-student@example.test')).toBeNull()
    expect(screen.queryByText('INTERNAL-SECRET')).toBeNull()
    expect(screen.queryByText('UNRELATED-MESSAGE')).toBeNull()
    expect(screen.queryByText('PRIVATE-DOCUMENT-CONTENT')).toBeNull()
  })
})

function queueQuery(items: ReturnType<typeof queueItem>[]) {
  return queryResult(
    {
      pages: [{ items, pendingCount: items.length, nextCursor: null }],
      pageParams: [null],
    },
    {
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    },
  ) as unknown as ReturnType<typeof useInstructorReviewQueue>
}

function queueItem() {
  return {
    reviewCaseId,
    status: 'PENDING' as const,
    trigger: 'STUDENT_REQUEST' as const,
    createdAt: '2026-07-29T10:00:00.000Z',
    age: 120,
    course: { id: courseId, code: 'C1', title: 'Course One' },
    student: { id: studentId, displayName: 'Safe Student' },
    pending: true,
  }
}

function detail() {
  const message = (role: 'STUDENT' | 'ASSISTANT', content: string) => ({
    role,
    content,
    createdAt: '2026-07-29T09:00:00.000Z',
  })
  return {
    reviewCaseId,
    status: 'PENDING' as const,
    trigger: 'STUDENT_REQUEST' as const,
    createdAt: '2026-07-29T10:00:00.000Z',
    requestedAt: '2026-07-29T10:00:01.000Z',
    studentNote: 'Please check the explanation.',
    course: { id: courseId, code: 'C1', title: 'Course One' },
    student: { id: studentId, displayName: 'Safe Student' },
    flaggedExchange: message('STUDENT', 'Flagged question'),
    assistantResponse: {
      ...message('ASSISTANT', 'Flagged assistant answer'),
      citations: [
        {
          order: 1,
          materialId,
          materialTitle: 'Course source',
          snippets: [{ chunkNumber: 2, excerpt: 'Bounded citation snippet' }],
        },
      ],
    },
    previousExchange: {
      studentMessage: message('STUDENT', 'Previous question'),
      assistantResponse: message('ASSISTANT', 'Previous answer'),
    },
    followingExchange: {
      studentMessage: message('STUDENT', 'Following question'),
      assistantResponse: message('ASSISTANT', 'Following answer'),
    },
    reviewSummary: {
      reviewCaseId,
      status: 'PENDING' as const,
      outcome: null,
      resolvedAt: null,
      hasNotification: false,
    },
  }
}
