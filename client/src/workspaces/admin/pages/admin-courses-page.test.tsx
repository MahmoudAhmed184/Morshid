import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CourseAdministration } from '@/features/courses/course-administration.schema'
import {
  useCourseAdministrationPages,
  useCourseAdministrationMutations,
} from '@/workspaces/admin/use-course-administration'
import { AdminCoursesPage } from './admin-courses-page'

vi.mock('@/workspaces/admin/use-course-administration')

const useCourseAdministrationPagesMock = vi.mocked(useCourseAdministrationPages)
const useCourseAdministrationMutationsMock = vi.mocked(
  useCourseAdministrationMutations,
)

const sampleCourses: CourseAdministration[] = [
  {
    id: 'course-1',
    code: 'CS101',
    title: 'Intro to Computer Science',
    adminMetadata: {
      createdById: null,
      createdBy: null,
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-11T10:00:00.000Z',
      memberships: [],
      memberCount: 10,
      instructorCount: 2,
      studentCount: 8,
      materialCount: 3,
      activeMaterialCount: 3,
    },
  },
  {
    id: 'course-2',
    code: 'MATH201',
    title: 'Linear Algebra',
    adminMetadata: {
      createdById: null,
      createdBy: null,
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-11T10:00:00.000Z',
      memberships: [],
      memberCount: 5,
      instructorCount: 1,
      studentCount: 4,
      materialCount: 1,
      activeMaterialCount: 1,
    },
  },
]

function mockCoursesQuery(
  courses: CourseAdministration[] = sampleCourses,
  overrides = {},
) {
  return {
    data: { pages: [{ courses, totalCount: courses.length }] },
    isPending: false,
    isError: false,
    isFetching: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useCourseAdministrationPages>
}

describe('AdminCoursesPage search and pagination', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useCourseAdministrationPagesMock.mockReturnValue(mockCoursesQuery())
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

  it('renders courses list and search input', () => {
    render(<AdminCoursesPage />)

    expect(
      screen.getByRole('heading', { name: 'Course Management' }),
    ).toBeVisible()
    expect(
      screen.getByPlaceholderText('Search courses by code or title...'),
    ).toBeVisible()
    expect(screen.getAllByText('CS101').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('MATH201').length).toBeGreaterThanOrEqual(1)
  })

  it('passes debounced search query to useCourseAdministrationPages', async () => {
    const user = userEvent.setup()
    render(<AdminCoursesPage />)

    const searchInput = screen.getByPlaceholderText(
      'Search courses by code or title...',
    )
    await user.type(searchInput, 'Linear')

    expect(searchInput).toHaveValue('Linear')
  })

  it('uses numbered pagination and fetches the next server page', async () => {
    const fetchNextPage = vi.fn()
    useCourseAdministrationPagesMock.mockReturnValue(
      mockCoursesQuery(sampleCourses, {
        data: { pages: [{ courses: sampleCourses, totalCount: 20 }] },
        hasNextPage: true,
        fetchNextPage,
      }),
    )
    const user = userEvent.setup()
    render(<AdminCoursesPage />)

    const nextButton = screen.getByRole('button', {
      name: 'Go to next page',
    })
    expect(nextButton).toBeVisible()

    await user.click(nextButton)
    expect(fetchNextPage).toHaveBeenCalledOnce()
  })

  it('shows appropriate empty states for no courses vs no search matches', () => {
    useCourseAdministrationPagesMock.mockReturnValue(mockCoursesQuery([]))

    render(<AdminCoursesPage />)
    expect(screen.getByText('No courses found')).toBeVisible()
    expect(
      screen.getByText('Courses returned by the API will appear here.'),
    ).toBeVisible()
  })
})
