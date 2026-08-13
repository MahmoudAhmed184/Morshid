import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CourseAdministration } from '@/features/courses/course-administration.schema'

import { BulkCourseAssignmentDialog } from './bulk-course-assignment-dialog'

const student = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'student@morshid.demo',
  displayName: 'Demo Student',
  role: 'STUDENT',
  status: 'ACTIVE',
  createdAt: '2026-08-13T10:00:00.000Z',
  updatedAt: '2026-08-13T10:00:00.000Z',
  courseAssignments: {
    courseCount: 0,
    instructorCourseCount: 0,
    studentCourseCount: 0,
    courses: [],
  },
} as const

const assignedStudent = {
  id: '10000000-0000-4000-8000-000000000002',
  email: 'assigned@morshid.demo',
  displayName: 'Already Assigned Student',
  role: 'STUDENT',
  status: 'ACTIVE',
  createdAt: '2026-08-13T10:00:00.000Z',
  updatedAt: '2026-08-13T10:00:00.000Z',
  courseAssignments: {
    courseCount: 1,
    instructorCourseCount: 0,
    studentCourseCount: 1,
    courses: [
      {
        courseId: '20000000-0000-4000-8000-000000000001',
        code: 'CS-201',
        title: 'Data Structures',
        role: 'STUDENT',
      },
    ],
  },
} as const

vi.mock('@/workspaces/admin/users/use-user-management', () => ({
  useManagedUsers: () => ({
    data: {
      pages: [{ users: [student, assignedStudent], nextCursor: null }],
    },
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
}))

const course: CourseAdministration = {
  id: '20000000-0000-4000-8000-000000000001',
  code: 'CS-201',
  title: 'Data Structures',
  adminMetadata: {
    createdById: null,
    createdBy: null,
    createdAt: '2026-08-13T10:00:00.000Z',
    updatedAt: '2026-08-13T10:00:00.000Z',
    memberships: [],
    memberCount: 0,
    instructorCount: 0,
    studentCount: 0,
    materialCount: 0,
    activeMaterialCount: 0,
  },
}

describe('BulkCourseAssignmentDialog', () => {
  afterEach(cleanup)

  it('chooses courses before users without rendering role tabs', async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn().mockResolvedValue(undefined)

    render(
      <BulkCourseAssignmentDialog
        courses={[course]}
        role="STUDENT"
        isPending={false}
        onAssign={onAssign}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Assign students' }))
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByText('Choose courses')).toBeInTheDocument()
    expect(screen.queryByText('Demo Student')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('checkbox', { name: 'Data Structures — CS-201' }),
    )
    await user.click(screen.getByRole('button', { name: 'Choose students' }))
    expect(await screen.findByText('Demo Student')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /Demo Student/i }))
    await user.click(screen.getByRole('button', { name: 'Assign 1 students' }))

    await waitFor(() =>
      expect(onAssign).toHaveBeenCalledWith({
        courseIds: [course.id],
        userIds: [student.id],
        role: 'STUDENT',
      }),
    )
  })

  it('filters out students already assigned to any of the selected courses', async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn().mockResolvedValue(undefined)

    render(
      <BulkCourseAssignmentDialog
        courses={[course]}
        role="STUDENT"
        isPending={false}
        onAssign={onAssign}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Assign students' }))
    await user.click(
      screen.getByRole('checkbox', { name: 'Data Structures — CS-201' }),
    )
    await user.click(screen.getByRole('button', { name: 'Choose students' }))

    // Demo Student is not assigned, so should appear
    expect(await screen.findByText('Demo Student')).toBeInTheDocument()
    // Already Assigned Student is already in CS-201, so should NOT appear
    expect(
      screen.queryByText('Already Assigned Student'),
    ).not.toBeInTheDocument()
  })
})
