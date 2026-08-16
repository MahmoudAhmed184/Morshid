import '@testing-library/jest-dom/vitest'
import type * as TanStackReactRouter from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  useInstructorReviewQueue,
  useInstructorReviewWorkloadSummary,
} from '@/workspaces/instructor/reviews/use-reviews'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { writeInstructorPreferences } from '@/workspaces/instructor/preferences/instructor-workspace-preferences.storage'
import { ReviewQueuePage } from './review-queue-page'
import type { InstructorReviewQueueItem } from '@/features/reviews/interface/instructor-review.schema'

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
      params?: { reviewCaseId?: string }
      state?: unknown
    }) => (
      <a
        {...props}
        href={
          params?.reviewCaseId
            ? to.replace('$reviewCaseId', params.reviewCaseId)
            : to
        }
      />
    ),
  }
})

vi.mock('@/workspaces/instructor/reviews/use-reviews')

const useQueueMock = vi.mocked(useInstructorReviewQueue)
const useWorkloadSummaryMock = vi.mocked(useInstructorReviewWorkloadSummary)
const testUserId = 'instructor-1111-2222'

const sampleQueueItems: InstructorReviewQueueItem[] = [
  {
    reviewCaseId: '10000000-0000-4000-8000-000000000001',
    status: 'PENDING',
    trigger: 'STUDENT_REQUEST',
    triggers: ['STUDENT_REQUEST'],
    studentFlagReason: 'INCORRECT',
    studentNote: 'Needs help understanding recursion',
    createdAt: '2026-08-16T10:00:00.000Z',
    age: 120,
    student: {
      id: 'student-1',
      displayName: 'Alice Student',
    },
    course: {
      id: 'course-101',
      code: 'CS-101',
      title: 'Intro to CS',
    },
    pending: true,
  },
  {
    reviewCaseId: '10000000-0000-4000-8000-000000000002',
    status: 'IN_REVIEW',
    trigger: 'CITATION_MISSING',
    triggers: ['CITATION_MISSING'],
    studentFlagReason: null,
    studentNote: null,
    createdAt: '2026-08-16T09:00:00.000Z',
    age: 3600,
    student: {
      id: 'student-2',
      displayName: 'Bob Student',
    },
    course: {
      id: 'course-201',
      code: 'CS-201',
      title: 'Data Structures',
    },
    pending: false,
  },
]

function mockQueueQuery() {
  return {
    data: {
      pages: [
        {
          items: sampleQueueItems,
          pendingCount: 1,
          nextCursor: null,
        },
      ],
      pageParams: [null],
    },
    dataUpdatedAt: Date.now(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    isPending: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useInstructorReviewQueue>
}

describe('Review Queue Saved Filters & URL Sync', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.history.replaceState(null, '', '/instructor/review-queue')

    useAuthStore.setState({
      user: {
        id: testUserId,
        email: 'instructor@morshid.test',
        displayName: 'Test Instructor',
        role: 'INSTRUCTOR',
        status: 'ACTIVE',
      },
      tokenType: 'Bearer',
      accessToken: 'test-token',
      accessTokenExpiresAt: '2026-08-16T12:00:00.000Z',
      isAuthenticated: true,
      sessionVersion: 1,
    })

    useQueueMock.mockReturnValue(mockQueueQuery())
    useWorkloadSummaryMock.mockReturnValue({
      data: undefined,
      error: null,
      isError: false,
      isFetching: false,
      isPending: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useInstructorReviewWorkloadSummary>)
  })

  afterEach(() => {
    cleanup()
    window.history.replaceState(null, '', '/')
  })

  it('renders presets menu button with count badge', () => {
    writeInstructorPreferences(testUserId, {
      activeCourseId: null,
      savedFilters: [
        {
          id: 'preset-1',
          name: 'Pending Inquiries',
          criteria: { status: 'PENDING' },
          createdAt: new Date().toISOString(),
        },
      ],
    })

    render(<ReviewQueuePage />)

    const presetsBtn = screen.getByRole('button', {
      name: /Saved filter presets \(1 saved\)/i,
    })
    expect(presetsBtn).toBeVisible()
    expect(presetsBtn).toHaveTextContent('Presets')
    expect(presetsBtn).toHaveTextContent('1')
  })

  it('saves current active filters as a new preset', async () => {
    const user = userEvent.setup()
    render(<ReviewQueuePage />)

    // Open Presets menu
    const presetsBtn = screen.getByRole('button', {
      name: /Saved filter presets/i,
    })
    await user.click(presetsBtn)

    // Click Save current filter
    const saveOption = await screen.findByText('Save current filter as preset')
    await user.click(saveOption)

    // Fill filter name
    expect(await screen.findByText('Save Queue Filter')).toBeVisible()
    const nameInput = screen.getByPlaceholderText(/Pending CS-201 Bugs/i)
    await user.type(nameInput, 'My Custom Preset')

    // Submit
    const saveBtn = screen.getByRole('button', { name: 'Save preset' })
    await user.click(saveBtn)

    // Verify preset is saved and menu now shows 1 preset
    expect(
      screen.getByRole('button', { name: /Saved filter presets \(1 saved\)/i }),
    ).toBeVisible()
  })

  it('applies a saved filter preset and synchronizes URL query', async () => {
    writeInstructorPreferences(testUserId, {
      activeCourseId: null,
      savedFilters: [
        {
          id: 'preset-1',
          name: 'CS-201 In Review',
          criteria: {
            status: 'IN_REVIEW',
            courseId: 'course-201',
            trigger: 'CITATION_MISSING',
          },
          createdAt: new Date().toISOString(),
        },
      ],
    })

    const user = userEvent.setup()
    render(<ReviewQueuePage />)

    // Open Presets dropdown
    const presetsBtn = screen.getByRole('button', {
      name: /Saved filter presets \(1 saved\)/i,
    })
    await user.click(presetsBtn)

    // Click the preset to apply
    const presetItem = await screen.findByText('CS-201 In Review')
    await user.click(presetItem)

    // Verify filter state changed: Bob is visible, Alice is filtered out
    expect(screen.getByText('Bob Student')).toBeVisible()
    expect(screen.queryByText('Alice Student')).not.toBeInTheDocument()

    // Verify URL query was updated
    expect(window.location.search).toContain('status=IN_REVIEW')
    expect(window.location.search).toContain('courseId=course-201')
    expect(window.location.search).toContain('trigger=CITATION_MISSING')
  })

  it('synchronizes URL query when controls are set manually', async () => {
    const user = userEvent.setup()
    render(<ReviewQueuePage />)

    // Click 'In review' status tab
    const inReviewTab = screen.getByRole('tab', { name: /In review/i })
    await user.click(inReviewTab)

    expect(window.location.search).toContain('status=IN_REVIEW')

    // Click CS-101 course filter
    const cs101Btn = screen.getByRole('button', { name: 'CS-101' })
    await user.click(cs101Btn)

    expect(window.location.search).toContain('courseId=course-101')
  })

  it('initializes filter state from URL search params on mount', () => {
    window.history.replaceState(
      null,
      '',
      '/instructor/review-queue?status=IN_REVIEW&courseId=course-201',
    )

    render(<ReviewQueuePage />)

    // Bob Student (in CS-201 and IN_REVIEW) should match
    expect(screen.getByText('Bob Student')).toBeVisible()
    // Alice Student (in CS-101 and PENDING) should NOT match
    expect(screen.queryByText('Alice Student')).not.toBeInTheDocument()
  })

  it('isolates saved presets when switching authenticated users', () => {
    const userA = 'instructor-AAA'
    const userB = 'instructor-BBB'

    writeInstructorPreferences(userA, {
      activeCourseId: null,
      savedFilters: [
        {
          id: 'p-a',
          name: 'User A Preset',
          criteria: { status: 'PENDING' },
          createdAt: new Date().toISOString(),
        },
      ],
    })

    // Render as user B
    useAuthStore.setState({
      user: {
        id: userB,
        email: 'userb@morshid.test',
        displayName: 'Instructor B',
        role: 'INSTRUCTOR',
        status: 'ACTIVE',
      },
      tokenType: 'Bearer',
      accessToken: 'test-token',
      accessTokenExpiresAt: '2026-08-16T12:00:00.000Z',
      isAuthenticated: true,
      sessionVersion: 1,
    })

    render(<ReviewQueuePage />)

    // User B should not see User A's presets
    expect(
      screen.getByRole('button', { name: /Saved filter presets \(0 saved\)/i }),
    ).toBeVisible()
  })
})
