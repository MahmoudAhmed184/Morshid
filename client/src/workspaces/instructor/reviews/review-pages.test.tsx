import '@testing-library/jest-dom/vitest'
import type * as TanStackReactRouter from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/http/http'
import {
  useInstructorReviewDetail,
  useInstructorReviewQueue,
  useInstructorReviewWorkloadSummary,
  useRejectInstructorReview,
  useResolveInstructorReview,
} from '@/workspaces/instructor/reviews/use-reviews'
import type { InstructorReviewQueueItem } from '@/features/reviews/interface/instructor-review.schema'
import { instructorReviewDetailSchema } from '@/features/reviews/interface/instructor-review.schema'

import { ReviewDetailPage } from './review-detail-page'
import { ReviewQueuePage } from './review-queue-page'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackReactRouter>()
  return {
    ...actual,
    Link: ({
      to,
      params,
      state: _state,
      ...props
    }: React.ComponentProps<'a'> & {
      to: string
      params: { reviewCaseId: string }
      state?: unknown
    }) => (
      <a {...props} href={to.replace('$reviewCaseId', params.reviewCaseId)} />
    ),
  }
})

vi.mock('@/workspaces/instructor/reviews/use-reviews')

const useQueueMock = vi.mocked(useInstructorReviewQueue)
const useWorkloadSummaryMock = vi.mocked(useInstructorReviewWorkloadSummary)
const useDetailMock = vi.mocked(useInstructorReviewDetail)
const useResolveMock = vi.mocked(useResolveInstructorReview)
const useRejectMock = vi.mocked(useRejectInstructorReview)
const resolveMutate = vi.fn()
const rejectMutate = vi.fn()
const reviewCaseId = '10000000-0000-4000-8000-000000000001'
const courseId = '20000000-0000-4000-8000-000000000001'
const studentId = '30000000-0000-4000-8000-000000000001'
const materialId = '40000000-0000-4000-8000-000000000001'
const studentFlagReasonCases = [
  ['INCORRECT', 'Seems incorrect'],
  ['CONFUSING', 'Confusing or unclear'],
  ['UNHELPFUL', 'Not helpful'],
  ['COURSE_MISMATCH', 'Doesn’t match course material'],
  ['TOO_MUCH_ANSWER', 'Gave away too much'],
  ['OTHER', 'Other'],
] as const

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
  beforeEach(() => {
    vi.resetAllMocks()
    window.sessionStorage.clear()
    window.localStorage.clear()
    window.history.replaceState(null, '', '/instructor/review-queue')
    resolveMutate.mockResolvedValue({})
    rejectMutate.mockResolvedValue({})
    useWorkloadSummaryMock.mockReturnValue(
      queryResult({
        pendingCount: 1,
        inReviewCount: 0,
        claimedByMeCount: 0,
        totalActiveCount: 1,
        oldestPendingCreatedAt: '2026-07-29T10:00:00.000Z',
        oldestPendingAge: 60,
        byStudentFlagReason: [{ reason: 'INCORRECT', count: 1 }],
        byTriggerType: [{ trigger: 'STUDENT_REQUEST', count: 1 }],
      }) as unknown as ReturnType<typeof useInstructorReviewWorkloadSummary>,
    )
    useResolveMock.mockReturnValue(
      mutationResult(resolveMutate) as unknown as ReturnType<
        typeof useResolveInstructorReview
      >,
    )
    useRejectMock.mockReturnValue(
      mutationResult(rejectMutate) as unknown as ReturnType<
        typeof useRejectInstructorReview
      >,
    )
  })
  afterEach(() => cleanup())

  it('renders the server-ordered queue and pending count', () => {
    useQueueMock.mockReturnValue(queueQuery([queueItem()]))
    render(<ReviewQueuePage />)

    expect(screen.getByText('1 pending')).toBeVisible()
    expect(screen.getByText('Safe Student')).toBeVisible()
    expect(screen.getByText('Course One')).toBeVisible()
    expect(screen.getAllByText('Student request')).not.toHaveLength(0)
    const studentRequestBadge = screen
      .getAllByText('Student request')
      .find((element) => element.matches('[data-slot="badge"]'))
    expect(studentRequestBadge).toHaveAttribute('data-variant', 'info')
  })

  it('renders resolved reviews with the success tone', async () => {
    const user = userEvent.setup()
    useQueueMock.mockReturnValue(
      queueQuery([
        { ...queueItem(), status: 'RESOLVED' as const, pending: false },
      ]),
    )
    render(<ReviewQueuePage />)
    await user.click(screen.getByRole('tab', { name: /Resolved/ }))

    const resolvedBadge = screen
      .getAllByText('Resolved')
      .find((element) => element.closest('[data-slot="badge"]'))
      ?.closest('[data-slot="badge"]')
    expect(resolvedBadge).toHaveAttribute('data-variant', 'success')
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
    expect(
      screen.getByRole('button', { name: 'Source conflict' }),
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
    expect(
      screen.getByRole('link', { name: 'Review Safe Student in Course One' }),
    ).toHaveAttribute('href', `/instructor/review-queue/${reviewCaseId}`)
  })

  it('restores queue filters after the detail overlay remounts the queue', async () => {
    const user = userEvent.setup()
    useQueueMock.mockReturnValue(queueQuery([queueItem()]))
    render(<ReviewQueuePage />)

    await user.type(screen.getByRole('textbox'), 'course one')
    await user.click(screen.getByRole('tab', { name: /Resolved/ }))
    cleanup()

    render(<ReviewQueuePage />)

    expect(screen.getByRole('textbox')).toHaveValue('course one')
    expect(screen.getByRole('tab', { name: /Resolved/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('shows the Student flag category in the queue without replacing the trigger', () => {
    useQueueMock.mockReturnValue(queueQuery([queueItem()]))
    render(<ReviewQueuePage />)

    expect(screen.getAllByText('Student request').length).toBeGreaterThan(0)
    expect(
      screen
        .getAllByText('Seems incorrect')
        .find((element) => element.matches('[data-slot="badge"]')),
    ).toBeVisible()
  })

  it.each(studentFlagReasonCases)(
    'filters the queue by %s independently from trigger filters',
    async (studentFlagReason, label) => {
      const user = userEvent.setup()
      useQueueMock.mockReturnValue(queueQuery([queueItem()]))
      render(<ReviewQueuePage />)

      await user.click(screen.getByRole('button', { name: label }))

      expect(useQueueMock).toHaveBeenLastCalledWith(studentFlagReason)
      expect(
        screen.getByRole('button', { name: 'Student request' }),
      ).toBeVisible()
    },
  )

  it('keeps the Student reason controls available when a filter has no results', async () => {
    const user = userEvent.setup()
    useQueueMock.mockImplementation((studentFlagReason) =>
      studentFlagReason === null ? queueQuery([queueItem()]) : queueQuery([]),
    )
    render(<ReviewQueuePage />)

    await user.click(screen.getByRole('button', { name: 'Not helpful' }))

    expect(screen.getByText('No matching reviews')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Source conflict' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'All Student reasons' }),
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: 'All Student reasons' }),
    )

    expect(useQueueMock).toHaveBeenLastCalledWith(null)
  })

  it('preserves trigger and course controls across Student reason results', async () => {
    const user = userEvent.setup()
    const sourceConflict = {
      ...queueItem(),
      reviewCaseId: '10000000-0000-4000-8000-000000000099',
      trigger: 'SOURCE_CONFLICT' as const,
      triggers: ['SOURCE_CONFLICT' as const],
      studentFlagReason: null,
      course: {
        id: '20000000-0000-4000-8000-000000000099',
        code: 'C2',
        title: 'Course Two',
      },
    }
    useQueueMock.mockImplementation((studentFlagReason) =>
      studentFlagReason === null
        ? queueQuery([queueItem(), sourceConflict])
        : queueQuery([queueItem()]),
    )
    render(<ReviewQueuePage />)

    const sourceTrigger = screen.getByRole('button', {
      name: 'Source conflict',
    })
    await user.click(sourceTrigger)
    await user.click(screen.getByRole('button', { name: 'C2' }))
    await user.click(screen.getByRole('button', { name: 'Seems incorrect' }))

    expect(sourceTrigger).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'C2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.getByRole('button', { name: 'Citation missing' }),
    ).toBeVisible()
    expect(useQueueMock).toHaveBeenLastCalledWith('INCORRECT')
  })

  it.each(studentFlagReasonCases)(
    'accepts and renders the %s Student flag category as %s',
    (studentFlagReason, label) => {
      const parsed = instructorReviewDetailSchema.parse({
        ...detail(),
        studentFlagReason,
      })
      useDetailMock.mockReturnValue(
        queryResult(parsed) as unknown as ReturnType<
          typeof useInstructorReviewDetail
        >,
      )

      render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

      expect(parsed.studentFlagReason).toBe(studentFlagReason)
      expect(screen.getByText(label)).toBeVisible()
    },
  )

  it('does not show a Student category for an automatic queue trigger', () => {
    useQueueMock.mockReturnValue(
      queueQuery([
        {
          ...queueItem(),
          trigger: 'CITATION_MISSING',
          triggers: ['CITATION_MISSING'],
          studentFlagReason: null,
          studentNote: null,
        },
      ]),
    )
    render(<ReviewQueuePage />)

    expect(screen.getAllByText('Citation missing').length).toBeGreaterThan(0)
    expect(
      screen
        .queryAllByText('Seems incorrect')
        .filter((element) => element.matches('[data-slot="badge"]')),
    ).toHaveLength(0)
  })

  it('filters loaded reviews by trigger', async () => {
    const user = userEvent.setup()
    useQueueMock.mockReturnValue(
      queueQuery([
        queueItem(),
        {
          ...queueItem(),
          reviewCaseId: '10000000-0000-4000-8000-000000000099',
          trigger: 'POLICY_CHECK_FAILED',
          triggers: ['POLICY_CHECK_FAILED', 'CITATION_MISSING'],
          studentFlagReason: null,
          studentNote: null,
          student: {
            id: '20000000-0000-4000-8000-000000000099',
            displayName: 'Citation Student',
          },
        },
      ]),
    )
    render(<ReviewQueuePage />)

    await user.click(screen.getByRole('button', { name: 'Citation missing' }))

    expect(screen.getByText('Citation Student')).toBeVisible()
    expect(screen.queryByText('Safe Student')).not.toBeInTheDocument()
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
    expect(screen.getByText('Student flag category')).toBeVisible()
    expect(screen.getByText('Confusing or unclear')).toBeVisible()
  })

  it('does not show a Student category for an automatic review detail', () => {
    useDetailMock.mockReturnValue(
      detailQuery({
        trigger: 'POLICY_CHECK_FAILED',
        triggers: ['POLICY_CHECK_FAILED', 'CITATION_MISSING'],
        studentFlagReason: null,
        studentNote: null,
      }),
    )
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

    expect(screen.getByText(/Citation missing/)).toBeVisible()
    expect(screen.getByText(/Policy check failed/)).toBeVisible()
    expect(screen.queryByText('Student flag category')).not.toBeInTheDocument()
  })

  it('rejects unknown Student flag categories in Instructor detail responses', () => {
    expect(() =>
      instructorReviewDetailSchema.parse({
        ...detail(),
        studentFlagReason: 'UNKNOWN_REASON',
      }),
    ).toThrow()
  })

  it('uses compact metadata in the dialog presentation', () => {
    useDetailMock.mockReturnValue(
      queryResult(detail()) as unknown as ReturnType<
        typeof useInstructorReviewDetail
      >,
    )
    render(
      <ReviewDetailPage reviewCaseId={reviewCaseId} presentation="dialog" />,
    )

    expect(
      screen.getByRole('heading', { name: 'Review flagged response' }),
    ).toBeVisible()
    expect(screen.getByText('Course One')).toBeVisible()
    expect(screen.getByText('Safe Student')).toBeVisible()
    expect(screen.getByText('Student request')).toBeVisible()
  })

  it('renders all eligible actions for an open manual review', () => {
    useDetailMock.mockReturnValue(detailQuery())
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

    expect(
      screen.getByRole('button', { name: 'Approve original guidance' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Publish edited guidance' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Publish replacement guidance' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Reject request' })).toBeVisible()
  })

  it('hides actions for terminal cases', () => {
    useDetailMock.mockReturnValue(
      detailQuery({ status: 'RESOLVED', canReject: false }),
    )
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

    expect(screen.queryByText('Review actions')).toBeNull()
  })

  it('hides rejection when the backend marks the case ineligible', () => {
    useDetailMock.mockReturnValue(detailQuery({ canReject: false }))
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

    expect(screen.queryByRole('button', { name: 'Reject request' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Approve original guidance' }),
    ).toBeVisible()
  })

  it('blocks empty edited guidance inline', async () => {
    const user = userEvent.setup()
    useDetailMock.mockReturnValue(detailQuery())
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

    await user.click(
      screen.getByRole('button', { name: 'Publish edited guidance' }),
    )
    const editor = screen.getByLabelText('Edited guidance')
    expect(editor).toHaveValue('Flagged assistant answer')
    await user.clear(editor)
    await user.click(screen.getByRole('button', { name: 'Publish guidance' }))

    expect(
      screen.getByText('Enter reviewed guidance before publishing.'),
    ).toBeVisible()
    expect(resolveMutate).not.toHaveBeenCalled()
  })

  it('keeps the edited working draft while switching action modes', async () => {
    const user = userEvent.setup()
    useDetailMock.mockReturnValue(detailQuery())
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

    await user.click(
      screen.getByRole('button', { name: 'Publish edited guidance' }),
    )
    const editor = screen.getByLabelText('Edited guidance')
    await user.clear(editor)
    await user.type(editor, 'Working edit')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(
      screen.getByRole('button', { name: 'Publish replacement guidance' }),
    )
    expect(screen.getByLabelText('Replacement guidance')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(
      screen.getByRole('button', { name: 'Publish edited guidance' }),
    )

    expect(screen.getByLabelText('Edited guidance')).toHaveValue('Working edit')
  })

  it('saves and restores a browser draft after remounting the review', async () => {
    const user = userEvent.setup()
    useDetailMock.mockReturnValue(detailQuery())
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

    await user.click(
      screen.getByRole('button', { name: 'Publish edited guidance' }),
    )
    const editor = screen.getByLabelText('Edited guidance')
    await user.clear(editor)
    await user.type(editor, 'Saved browser draft')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(
      screen.getByText('Draft saved in this browser for this tab.'),
    ).toBeVisible()

    cleanup()
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)
    await user.click(
      screen.getByRole('button', { name: 'Publish edited guidance' }),
    )

    expect(screen.getByLabelText('Edited guidance')).toHaveValue(
      'Saved browser draft',
    )
  })

  it('blocks an empty rejection reason inline', async () => {
    const user = userEvent.setup()
    useDetailMock.mockReturnValue(detailQuery())
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

    await user.click(screen.getByRole('button', { name: 'Reject request' }))
    await user.click(screen.getByRole('button', { name: 'Confirm rejection' }))

    expect(
      screen.getByText('Enter a reason before rejecting this request.'),
    ).toBeVisible()
    expect(rejectMutate).not.toHaveBeenCalled()
  })

  it('submits trimmed edited guidance with the current version', async () => {
    const user = userEvent.setup()
    useDetailMock.mockReturnValue(detailQuery({ version: 7 }))
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

    await user.click(
      screen.getByRole('button', { name: 'Publish edited guidance' }),
    )
    await user.clear(screen.getByLabelText('Edited guidance'))
    await user.type(
      screen.getByLabelText('Edited guidance'),
      '  Better answer  ',
    )
    await user.click(screen.getByRole('button', { name: 'Publish guidance' }))
    await user.click(screen.getByRole('button', { name: 'Publish outcome' }))

    expect(resolveMutate).toHaveBeenCalledWith({
      reviewCaseId,
      idempotencyKey: expect.any(String),
      request: {
        expectedVersion: 7,
        outcome: 'EDITED',
        content: 'Better answer',
      },
    })
    expect(screen.getByText('Flagged assistant answer')).toBeVisible()
  })

  it('reuses the same idempotency key after an ambiguous action failure', async () => {
    const user = userEvent.setup()
    resolveMutate
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce({})
    useDetailMock.mockReturnValue(detailQuery({ version: 7 }))
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

    await user.click(
      screen.getByRole('button', { name: 'Publish edited guidance' }),
    )
    const editor = screen.getByLabelText('Edited guidance')
    await user.clear(editor)
    await user.type(editor, 'Retry-safe guidance')

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await user.click(screen.getByRole('button', { name: 'Publish guidance' }))
      await user.click(screen.getByRole('button', { name: 'Publish outcome' }))
    }

    expect(resolveMutate).toHaveBeenCalledTimes(2)
    expect(resolveMutate.mock.calls[1]?.[0].idempotencyKey).toBe(
      resolveMutate.mock.calls[0]?.[0].idempotencyKey,
    )
  })

  it('disables every action while a mutation is pending', () => {
    useResolveMock.mockReturnValue(
      mutationResult(resolveMutate, true) as unknown as ReturnType<
        typeof useResolveInstructorReview
      >,
    )
    useDetailMock.mockReturnValue(detailQuery())
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

    for (const button of screen.getAllByRole('button')) {
      if (button.textContent !== 'Back to queue') {
        expect(button).toBeDisabled()
      }
    }
  })

  it('shows a safe stale-version conflict without changing the original response', async () => {
    const user = userEvent.setup()
    resolveMutate.mockRejectedValue(
      new ApiError('Internal concurrency detail', 409, 'STALE_REVIEW_VERSION'),
    )
    useDetailMock.mockReturnValue(detailQuery())
    render(<ReviewDetailPage reviewCaseId={reviewCaseId} />)

    await user.click(
      screen.getByRole('button', { name: 'Approve original guidance' }),
    )
    await user.click(screen.getByRole('button', { name: 'Publish outcome' }))

    expect(
      await screen.findByText(
        'This review changed before your action was submitted. Refresh and try again.',
      ),
    ).toBeVisible()
    expect(screen.queryByText('Internal concurrency detail')).toBeNull()
    expect(screen.getByText('Flagged assistant answer')).toBeVisible()
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

  it('filters queue items when clicking workload summary metrics', async () => {
    const user = userEvent.setup()
    useWorkloadSummaryMock.mockReturnValue(
      queryResult({
        pendingCount: 1,
        inReviewCount: 0,
        claimedByMeCount: 0,
        totalActiveCount: 1,
        oldestPendingCreatedAt: '2026-07-29T10:00:00.000Z',
        oldestPendingAge: 60,
        byStudentFlagReason: [
          { reason: 'INCORRECT', count: 1 },
          { reason: 'CONFUSING', count: 1 },
        ],
        byTriggerType: [{ trigger: 'STUDENT_REQUEST', count: 2 }],
      }) as unknown as ReturnType<typeof useInstructorReviewWorkloadSummary>,
    )

    useQueueMock.mockReturnValue(
      queueQuery([
        { ...queueItem(), status: 'PENDING' as const },
        {
          ...queueItem(),
          reviewCaseId: '10000000-0000-4000-8000-000000000002',
          status: 'RESOLVED' as const,
          studentNote: 'Confusing explanation',
        },
      ]),
    )

    render(<ReviewQueuePage />)

    expect(screen.getByText('Workload by Student Flag Reason')).toBeVisible()

    // Click Resolved metric card
    const resolvedBtn = screen.getByRole('button', {
      name: /Resolved cases: 1/i,
    })
    await user.click(resolvedBtn)

    // Should now show the resolved item
    expect(screen.getByText(/Confusing explanation/)).toBeVisible()
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

function queueItem(): InstructorReviewQueueItem {
  return {
    reviewCaseId,
    status: 'PENDING' as const,
    trigger: 'STUDENT_REQUEST' as const,
    triggers: ['STUDENT_REQUEST' as const],
    studentFlagReason: 'INCORRECT' as const,
    studentNote: 'Please verify this answer.',
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
    version: 3,
    canReject: true,
    trigger: 'STUDENT_REQUEST' as const,
    triggers: ['STUDENT_REQUEST' as const],
    studentFlagReason: 'CONFUSING' as const,
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
    actions: [],
    reviewSummary: {
      reviewCaseId,
      status: 'PENDING' as const,
      outcome: null,
      resolvedAt: null,
    },
  }
}

function detailQuery(overrides: Record<string, unknown> = {}) {
  return queryResult({
    ...detail(),
    ...overrides,
  }) as unknown as ReturnType<typeof useInstructorReviewDetail>
}

function mutationResult(
  mutateAsync: ReturnType<typeof vi.fn>,
  isPending = false,
) {
  return {
    mutateAsync,
    isPending,
    error: null,
    isError: false,
  }
}
