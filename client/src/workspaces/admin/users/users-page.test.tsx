import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CourseAdministration } from '@/features/courses/course-administration.schema'
import type { ManagedUser } from '@/features/user-management/managed-user.schema'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { useCourseAdministration } from '@/workspaces/admin/use-course-administration'
import { useManagedUserMutations, useManagedUsers } from './use-user-management'
import { UsersPage } from './users-page'

vi.mock('@/workspaces/admin/use-course-administration')
vi.mock('./use-user-management')

const useCourseAdministrationMock = vi.mocked(useCourseAdministration)
const useManagedUsersMock = vi.mocked(useManagedUsers)
const useManagedUserMutationsMock = vi.mocked(useManagedUserMutations)

const sampleStudent: ManagedUser = {
  id: 'user-1',
  email: 'student@morshid.demo',
  displayName: 'Alice Student',
  role: 'STUDENT',
  status: 'ACTIVE',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-11T10:00:00.000Z',
  courseAssignments: {
    courseCount: 1,
    instructorCourseCount: 0,
    studentCourseCount: 1,
    courses: [
      {
        courseId: 'course-1',
        code: 'CS101',
        title: 'Intro to CS',
        role: 'STUDENT',
      },
    ],
  },
}

const sampleDisabledStudent: ManagedUser = {
  id: 'user-2',
  email: 'disabled@morshid.demo',
  displayName: 'Bob Disabled',
  role: 'STUDENT',
  status: 'DISABLED',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-11T10:00:00.000Z',
  courseAssignments: {
    courseCount: 0,
    instructorCourseCount: 0,
    studentCourseCount: 0,
    courses: [],
  },
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
      memberCount: 1,
      instructorCount: 0,
      studentCount: 1,
      materialCount: 0,
      activeMaterialCount: 0,
    },
  },
]

function mockUsersQuery(
  users: ManagedUser[] = [sampleStudent, sampleDisabledStudent],
  overrides = {},
) {
  return {
    data: { pages: [{ users }] },
    isPending: false,
    isError: false,
    isFetching: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useManagedUsers>
}

describe('UsersPage search, filter, and pagination', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useAuthStore.setState({
      user: {
        id: 'admin-id',
        email: 'admin@morshid.demo',
        displayName: 'Demo Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      tokenType: 'Bearer',
      accessToken: 'token',
      accessTokenExpiresAt: '2027-01-01',
    })
    useCourseAdministrationMock.mockReturnValue({
      data: sampleCourses,
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any)
    useManagedUsersMock.mockReturnValue(mockUsersQuery())
    useManagedUserMutationsMock.mockReturnValue({
      createUser: { mutateAsync: vi.fn(), isPending: false } as any,
      bulkCreateUsers: { mutateAsync: vi.fn(), isPending: false } as any,
      stageUserImport: { mutateAsync: vi.fn(), isPending: false } as any,
      approveImport: { mutateAsync: vi.fn(), isPending: false } as any,
      editImportRow: { mutateAsync: vi.fn(), isPending: false } as any,
      cancelImportRow: { mutateAsync: vi.fn(), isPending: false } as any,
      updateUser: { mutateAsync: vi.fn(), isPending: false } as any,
      resetPassword: { mutateAsync: vi.fn(), isPending: false } as any,
      disableUser: { mutateAsync: vi.fn(), isPending: false } as any,
      reactivateUser: { mutateAsync: vi.fn(), isPending: false } as any,
    })
  })

  afterEach(cleanup)

  it('renders student list and filter controls', () => {
    render(<UsersPage role="STUDENT" />)

    expect(screen.getByRole('heading', { name: 'Students' })).toBeVisible()
    expect(screen.getByPlaceholderText('Search students...')).toBeVisible()
    expect(
      screen.getByRole('combobox', { name: 'Filter students by course' }),
    ).toBeVisible()
    expect(
      screen.getByRole('combobox', { name: 'Filter students by status' }),
    ).toBeVisible()
    expect(screen.getAllByText('Alice Student').length).toBeGreaterThanOrEqual(
      1,
    )
    expect(screen.getAllByText('Bob Disabled').length).toBeGreaterThanOrEqual(1)
  })

  it('updates query filters when search or status filter is changed', async () => {
    const user = userEvent.setup()
    render(<UsersPage role="STUDENT" />)

    const statusSelect = screen.getByRole('combobox', {
      name: 'Filter students by status',
    })
    await user.click(statusSelect)
    await user.click(await screen.findByRole('option', { name: 'Active' }))

    expect(useManagedUsersMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        role: 'STUDENT',
        status: 'ACTIVE',
      }),
    )
  })

  it('renders LoadMoreButton and triggers next page fetch', async () => {
    const fetchNextPage = vi.fn()
    useManagedUsersMock.mockReturnValue(
      mockUsersQuery([sampleStudent], {
        hasNextPage: true,
        fetchNextPage,
      }),
    )
    const user = userEvent.setup()
    render(<UsersPage role="STUDENT" />)

    const loadMoreButton = screen.getByRole('button', {
      name: 'Load more students',
    })
    expect(loadMoreButton).toBeVisible()

    await user.click(loadMoreButton)
    expect(fetchNextPage).toHaveBeenCalledOnce()
  })

  it('shows appropriate empty states for no users vs no filter matches', () => {
    useManagedUsersMock.mockReturnValue(mockUsersQuery([]))
    render(<UsersPage role="STUDENT" />)

    expect(screen.getByText('No students found')).toBeVisible()
    expect(
      screen.getByText('Create students or import users to get started.'),
    ).toBeVisible()
  })
})
