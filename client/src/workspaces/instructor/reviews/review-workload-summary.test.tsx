import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ReviewWorkloadSummary } from './review-workload-summary'
import type { InstructorReviewWorkloadSummary } from '@/features/reviews/interface/instructor-review.schema'

const mockSummary: InstructorReviewWorkloadSummary = {
  pendingCount: 4,
  inReviewCount: 2,
  claimedByMeCount: 1,
  totalActiveCount: 6,
  oldestPendingCreatedAt: '2026-07-29T10:00:00.000Z',
  oldestPendingAge: 720,
  byStudentFlagReason: [
    { reason: 'INCORRECT', count: 3 },
    { reason: 'CONFUSING', count: 1 },
    { reason: 'UNHELPFUL', count: 0 },
    { reason: 'COURSE_MISMATCH', count: 0 },
    { reason: 'TOO_MUCH_ANSWER', count: 0 },
    { reason: 'OTHER', count: 0 },
  ],
  byTriggerType: [
    { trigger: 'STUDENT_REQUEST', count: 4 },
    { trigger: 'CITATION_MISSING', count: 2 },
    { trigger: 'GENERAL_NOT_FOUND', count: 0 },
    { trigger: 'SOURCE_CONFLICT', count: 0 },
    { trigger: 'POLICY_CHECK_FAILED', count: 0 },
    { trigger: 'FINAL_ANSWER_RISK', count: 0 },
  ],
}

describe('ReviewWorkloadSummary', () => {
  afterEach(cleanup)

  it('renders workload metrics and breakdown tables', () => {
    render(<ReviewWorkloadSummary summary={mockSummary} />)

    expect(screen.getByText('Pending')).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Review Workload Snapshot' }),
    ).toBeVisible()
    expect(screen.getAllByText('4').length).toBeGreaterThan(0)
    expect(screen.getByText('In Review')).toBeVisible()
    expect(screen.getByText('Claimed by Me')).toBeVisible()
    expect(screen.getByText('12m')).toBeVisible()

    expect(screen.getByText('Workload by Student Flag Reason')).toBeVisible()
    expect(screen.getByText('Seems incorrect')).toBeVisible()
    expect(screen.getByText('Confusing or unclear')).toBeVisible()

    expect(screen.getByText('Workload by Trigger Type')).toBeVisible()
    expect(screen.getByText('Student request')).toBeVisible()
    expect(screen.getByText('Citation missing')).toBeVisible()
  })

  it('renders zero state when totalActiveCount is zero', () => {
    const zeroSummary: InstructorReviewWorkloadSummary = {
      pendingCount: 0,
      inReviewCount: 0,
      claimedByMeCount: 0,
      totalActiveCount: 0,
      oldestPendingCreatedAt: null,
      oldestPendingAge: null,
      byStudentFlagReason: [],
      byTriggerType: [],
    }

    render(<ReviewWorkloadSummary summary={zeroSummary} />)

    expect(
      screen.getByText('All clear — No review cases need attention'),
    ).toBeVisible()
    expect(
      screen.getByText(/There are currently no pending or in-review cases/i),
    ).toBeVisible()
  })

  it('renders loading skeleton when isLoading is true', () => {
    render(<ReviewWorkloadSummary isLoading />)
    expect(
      screen.getByRole('status', { name: 'Loading review workload summary' }),
    ).toBeVisible()
  })

  it('renders error state with retry action', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()

    render(
      <ReviewWorkloadSummary
        error={new Error('Network disconnected')}
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText('Unable to load workload summary')).toBeVisible()
    expect(screen.getByText('Network disconnected')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('invokes callback handlers when interactive metrics or breakdown rows are clicked', async () => {
    const user = userEvent.setup()
    const onSelectStatus = vi.fn()
    const onSelectStudentFlagReason = vi.fn()
    const onSelectTrigger = vi.fn()

    render(
      <ReviewWorkloadSummary
        summary={mockSummary}
        onSelectStatus={onSelectStatus}
        onSelectStudentFlagReason={onSelectStudentFlagReason}
        onSelectTrigger={onSelectTrigger}
      />,
    )

    // Click Pending metric
    const pendingButton = screen.getByRole('button', {
      name: /Pending cases: 4/i,
    })
    await user.click(pendingButton)
    expect(onSelectStatus).toHaveBeenCalledWith('PENDING')

    // Click In Review metric
    const inReviewButton = screen.getByRole('button', {
      name: /In review cases: 2/i,
    })
    await user.click(inReviewButton)
    expect(onSelectStatus).toHaveBeenCalledWith('IN_REVIEW')

    // Click Seems incorrect reason row
    await user.click(screen.getByText('Seems incorrect'))
    expect(onSelectStudentFlagReason).toHaveBeenCalledWith('INCORRECT')

    // Click Citation missing trigger row
    await user.click(screen.getByText('Citation missing'))
    expect(onSelectTrigger).toHaveBeenCalledWith('CITATION_MISSING')
  })
})
