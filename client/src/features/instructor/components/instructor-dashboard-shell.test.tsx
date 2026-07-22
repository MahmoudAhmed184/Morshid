import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useInstructorCourses } from '@/features/instructor/hooks/use-instructor-courses'

import { InstructorDashboardShell } from './instructor-dashboard-shell'

vi.mock('@/features/instructor/hooks/use-instructor-courses')
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

const useInstructorCoursesMock = vi.mocked(useInstructorCourses)
const refetchCourses = vi.fn()

function coursesResult(overrides: Record<string, unknown> = {}) {
  return {
    data: [
      {
        id: 'f5bb713c-09b7-42d3-acf3-02f39a902e5a',
        code: 'CS-201',
        title: 'Data Structures',
        membershipRole: 'INSTRUCTOR',
        canManageMaterials: true,
      },
      {
        id: '7fc308e8-dc70-43dc-933c-7ee3c548c889',
        code: 'MATH-310',
        title: 'Discrete Mathematics',
        membershipRole: 'INSTRUCTOR',
        canManageMaterials: true,
      },
    ],
    isError: false,
    isFetching: false,
    isPending: false,
    refetch: refetchCourses,
    ...overrides,
  } as unknown as ReturnType<typeof useInstructorCourses>
}

describe('InstructorDashboardShell', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useInstructorCoursesMock.mockReturnValue(coursesResult())
  })

  afterEach(cleanup)

  it('switches the Register course panel while keeping live status work course-scoped', async () => {
    const user = userEvent.setup()
    render(<InstructorDashboardShell />)

    expect(
      screen.getByRole('heading', { name: 'Data Structures' }),
    ).toBeVisible()
    expect(screen.getByRole('group', { name: 'Switch course' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'MATH-310' }))

    expect(
      screen.getByRole('heading', { name: 'Discrete Mathematics' }),
    ).toBeVisible()
    expect(
      screen.getByText('Source readiness is course-specific'),
    ).toBeVisible()
  })

  it('retries a failed course-context request', async () => {
    useInstructorCoursesMock.mockReturnValue(
      coursesResult({
        data: undefined,
        isError: true,
      }),
    )
    const user = userEvent.setup()

    render(<InstructorDashboardShell />)
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(refetchCourses).toHaveBeenCalledOnce()
  })
})
