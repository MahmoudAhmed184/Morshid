import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CourseAdministration,
  CourseMember,
} from '@/features/courses/course-administration.schema'
import {
  useCourseAdministration,
  useCourseAdministrationMutations,
  useCourseMembers,
} from '@/workspaces/admin/use-course-administration'
import { AdminAssignmentsPage } from './admin-assignments-page'

vi.mock('@/workspaces/admin/use-course-administration')

const useCourseAdministrationMock = vi.mocked(useCourseAdministration)
const useCourseMembersMock = vi.mocked(useCourseMembers)
const useCourseAdministrationMutationsMock = vi.mocked(
  useCourseAdministrationMutations,
)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return function QueryWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function renderAssignmentsPage() {
  return render(<AdminAssignmentsPage />, { wrapper: createWrapper() })
}

const sampleCourses: CourseAdministration[] = [
  {
    id: 'course-1',
    code: 'CS101',
    title: 'Intro to CS',
    adminMetadata: {
      createdById: null,
      createdBy: null,
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-11T10:00:00.000Z',
      memberships: [],
      memberCount: 2,
      instructorCount: 1,
      studentCount: 1,
      materialCount: 0,
      activeMaterialCount: 0,
    },
  },
  {
    id: 'course-2',
    code: 'CS102',
    title: 'Data Structures',
    adminMetadata: {
      createdById: null,
      createdBy: null,
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-11T10:00:00.000Z',
      memberships: [],
      memberCount: 0,
      instructorCount: 0,
      studentCount: 0,
      materialCount: 0,
      activeMaterialCount: 0,
    },
  },
]

const sampleMembers: CourseMember[] = [
  {
    id: 'mem-1',
    userId: 'user-1',
    role: 'STUDENT',
    createdAt: '2026-07-01T10:00:00.000Z',
    user: {
      id: 'user-1',
      email: 'student@morshid.demo',
      displayName: 'Alice Student',
      role: 'STUDENT',
      status: 'ACTIVE',
    },
  },
  {
    id: 'mem-2',
    userId: 'user-2',
    role: 'INSTRUCTOR',
    createdAt: '2026-07-01T10:00:00.000Z',
    user: {
      id: 'user-2',
      email: 'prof@morshid.demo',
      displayName: 'Bob Instructor',
      role: 'INSTRUCTOR',
      status: 'ACTIVE',
    },
  },
]

function mockCoursesQuery(courses: CourseAdministration[] = sampleCourses) {
  return {
    data: courses,
    isPending: false,
    isError: false,
    isFetching: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useCourseAdministration>
}

function mockMembersQuery(
  members: CourseMember[] = sampleMembers,
  overrides = {},
) {
  return {
    data: { pages: [{ members, totalCount: members.length }] },
    isPending: false,
    isError: false,
    isFetching: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useCourseMembers>
}

describe('AdminAssignmentsPage search and tabs', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useCourseAdministrationMock.mockReturnValue(mockCoursesQuery())
    useCourseMembersMock.mockReturnValue(mockMembersQuery())
    useCourseAdministrationMutationsMock.mockReturnValue({
      createCourse: { mutateAsync: vi.fn(), isPending: false } as any,
      updateCourse: { mutateAsync: vi.fn(), isPending: false } as any,
      deleteCourse: { mutateAsync: vi.fn(), isPending: false } as any,
      addMember: { mutateAsync: vi.fn(), isPending: false } as any,
      addMembers: { mutateAsync: vi.fn(), isPending: false } as any,
      updateMemberRole: { mutateAsync: vi.fn(), isPending: false } as any,
      removeMember: { mutateAsync: vi.fn(), isPending: false } as any,
    })
  })

  afterEach(cleanup)

  it('renders assignments page with student tab active and search input', () => {
    renderAssignmentsPage()

    expect(
      screen.getByRole('heading', { name: 'Course Assignments' }),
    ).toBeVisible()
    expect(
      screen.getByPlaceholderText('Search assigned students...'),
    ).toBeVisible()
    expect(screen.getAllByText('Alice Student').length).toBeGreaterThanOrEqual(
      1,
    )
  })

  it('resets search when switching role tab between Students and Instructors', async () => {
    const user = userEvent.setup()
    renderAssignmentsPage()

    const searchInput = screen.getByPlaceholderText(
      'Search assigned students...',
    )
    await user.type(searchInput, 'Alice')
    expect(searchInput).toHaveValue('Alice')

    const instructorTab = screen.getByRole('tab', { name: /Instructors/i })
    await user.click(instructorTab)

    expect(
      screen.getByPlaceholderText('Search assigned instructors...'),
    ).toHaveValue('')
  })

  it('resets search when selecting a different course', async () => {
    const user = userEvent.setup()
    renderAssignmentsPage()

    const searchInput = screen.getByPlaceholderText(
      'Search assigned students...',
    )
    await user.type(searchInput, 'Alice')
    expect(searchInput).toHaveValue('Alice')

    const courseSearch = screen.getByRole('textbox', { name: 'Course' })
    await user.click(courseSearch)
    await user.click(
      await screen.findByRole('button', { name: /Data Structures/ }),
    )

    expect(searchInput).toHaveValue('')
  })

  it('closes the course picker on Escape and outside interaction', async () => {
    const user = userEvent.setup()
    renderAssignmentsPage()

    const courseSearch = screen.getByRole('textbox', { name: 'Course' })
    await user.click(courseSearch)
    expect(
      screen.getByRole('button', { name: /Data Structures/ }),
    ).toBeVisible()

    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('button', { name: /Data Structures/ }),
    ).not.toBeInTheDocument()
    expect(courseSearch).not.toHaveFocus()

    await user.click(courseSearch)
    await user.click(document.body)
    expect(
      screen.queryByRole('button', { name: /Data Structures/ }),
    ).not.toBeInTheDocument()
  })

  it('supports pagination with numbered assignment pages', async () => {
    const fetchNextPage = vi.fn()
    useCourseMembersMock.mockReturnValue(
      mockMembersQuery(sampleMembers, {
        data: { pages: [{ members: sampleMembers, totalCount: 20 }] },
        hasNextPage: true,
        fetchNextPage,
      }),
    )
    const user = userEvent.setup()
    renderAssignmentsPage()

    const nextPageButton = screen.getByRole('button', {
      name: 'Go to next page',
    })
    expect(nextPageButton).toBeVisible()

    await user.click(nextPageButton)
    expect(fetchNextPage).toHaveBeenCalledOnce()
  })
})
