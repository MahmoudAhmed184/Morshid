import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveCourseMembers } from '@/features/courses/course-administration.api'
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

const instructor = {
  id: '20000000-0000-4000-8000-000000000002',
  email: 'instructor@morshid.demo',
  displayName: 'Demo Instructor',
  role: 'INSTRUCTOR',
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

const studentQueryResult = {
  data: { pages: [{ users: [student], nextCursor: null }] },
  isPending: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
}

const instructorQueryResult = {
  data: { pages: [{ users: [instructor], nextCursor: null }] },
  isPending: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
}

vi.mock('@/workspaces/admin/users/use-user-management', () => ({
  useManagedUsers: (filters: { role: string }) =>
    filters.role === 'INSTRUCTOR' ? instructorQueryResult : studentQueryResult,
}))

vi.mock('@/features/courses/course-administration.api', () => ({
  resolveCourseMembers: vi.fn(),
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

  it('pre-selects the defaultCourseId when opened and allows unselecting it', async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn().mockResolvedValue(undefined)

    render(
      <BulkCourseAssignmentDialog
        courses={[course]}
        defaultCourseId={course.id}
        role="STUDENT"
        isPending={false}
        onAssign={onAssign}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Assign students' }))
    expect(screen.getByText('Choose courses')).toBeInTheDocument()

    const courseCheckbox = screen.getByRole('checkbox', {
      name: 'Data Structures — CS-201',
    })
    expect(courseCheckbox).toBeChecked()

    // Unselect the course
    await user.click(courseCheckbox)
    expect(courseCheckbox).not.toBeChecked()

    // Re-select the course
    await user.click(courseCheckbox)
    expect(courseCheckbox).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Choose students' }))
    expect(await screen.findByText('Demo Student')).toBeInTheDocument()
  })

  it('resolves pasted student identifiers and adds matched users to selection', async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn().mockResolvedValue(undefined)
    const resolveCourseMembersMock = vi.mocked(resolveCourseMembers)

    resolveCourseMembersMock.mockResolvedValueOnce({
      resolved: [
        {
          id: student.id,
          email: student.email,
          displayName: student.displayName,
          role: 'STUDENT',
          matchedBy: student.email,
          alreadyAssignedCourseIds: [course.id],
        },
        {
          id: '10000000-0000-4000-8000-000000000003',
          email: 'student3@morshid.demo',
          displayName: 'Student Three',
          role: 'STUDENT',
          matchedBy: 'student3@morshid.demo',
          alreadyAssignedCourseIds: [],
        },
      ],
      unmatched: ['unknown@morshid.demo'],
      duplicates: ['student@morshid.demo'],
    })

    render(
      <BulkCourseAssignmentDialog
        courses={[course]}
        defaultCourseId={course.id}
        role="STUDENT"
        isPending={false}
        onAssign={onAssign}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Assign students' }))
    await user.click(screen.getByRole('button', { name: 'Choose students' }))

    // Open Bulk select / import modal
    await user.click(
      screen.getByRole('button', { name: /bulk select \/ import/i }),
    )
    expect(
      screen.getByText('Bulk select and import students'),
    ).toBeInTheDocument()

    // Paste identifiers
    const textarea = screen.getByPlaceholderText(/student1@morshid.demo/i)
    fireEvent.change(textarea, {
      target: { value: `${student.email}\nstudent3@morshid.demo` },
    })

    // Resolve
    await user.click(screen.getByRole('button', { name: /resolve students/i }))

    // Verify preview stats and details
    expect(await screen.findByText('Valid active students')).toBeInTheDocument()
    expect(screen.getByText('unknown@morshid.demo')).toBeInTheDocument()
    expect(
      screen.getAllByText('student@morshid.demo').length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('In CS-201')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()

    // Apply to selection
    await user.click(
      screen.getByRole('button', { name: /add 2 students to selection/i }),
    )

    // Verify view switches to Selected with 2 students
    expect(await screen.findByText(/selected \(2\)/i)).toBeInTheDocument()
    expect(screen.getByText('Student Three')).toBeInTheDocument()
    expect(screen.getByText('Demo Student')).toBeInTheDocument()

    // Unselect one individual student
    await user.click(screen.getByRole('checkbox', { name: /Demo Student/i }))
    expect(screen.getByText(/selected \(1\)/i)).toBeInTheDocument()

    // Final assign
    await user.click(screen.getByRole('button', { name: 'Assign 1 students' }))

    await waitFor(() =>
      expect(onAssign).toHaveBeenCalledWith({
        courseIds: [course.id],
        userIds: ['10000000-0000-4000-8000-000000000003'],
        role: 'STUDENT',
      }),
    )
  })

  it('reuses the same bulk assignment flow for instructors', async () => {
    const user = userEvent.setup()
    const onAssign = vi.fn().mockResolvedValue(undefined)
    const resolveCourseMembersMock = vi.mocked(resolveCourseMembers)

    resolveCourseMembersMock.mockResolvedValueOnce({
      resolved: [
        {
          id: instructor.id,
          email: instructor.email,
          displayName: instructor.displayName,
          role: 'INSTRUCTOR',
          matchedBy: instructor.email,
          alreadyAssignedCourseIds: [],
        },
      ],
      unmatched: [],
      duplicates: [],
    })

    render(
      <BulkCourseAssignmentDialog
        courses={[course]}
        defaultCourseId={course.id}
        role="INSTRUCTOR"
        isPending={false}
        onAssign={onAssign}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Assign instructors' }))
    await user.click(screen.getByRole('button', { name: 'Choose instructors' }))

    await user.click(
      screen.getByRole('button', { name: /bulk select \/ import/i }),
    )
    expect(
      screen.getByText('Bulk select and import instructors'),
    ).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText(/student1@morshid.demo/i)
    fireEvent.change(textarea, {
      target: { value: instructor.email },
    })

    await user.click(
      screen.getByRole('button', { name: /resolve instructors/i }),
    )

    await user.click(
      await screen.findByRole('button', {
        name: /add 1 instructors to selection/i,
      }),
    )

    await user.click(
      screen.getByRole('button', { name: 'Assign 1 instructors' }),
    )

    await waitFor(() =>
      expect(onAssign).toHaveBeenCalledWith({
        courseIds: [course.id],
        userIds: [instructor.id],
        role: 'INSTRUCTOR',
      }),
    )
  })
})
