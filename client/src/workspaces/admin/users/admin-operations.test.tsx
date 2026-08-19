import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CourseAdministration } from '@/features/courses/course-administration.schema'
import type { ManagedUser } from '@/features/user-management/managed-user.schema'

import { AddCourseMemberDialog } from '@/workspaces/admin/components/add-course-member-dialog'
import { AdminAssignmentsTable } from '@/workspaces/admin/components/admin-assignments-table'
import { UserActions } from './user-actions'
import {
  CreateAdminCourseDialog,
  EditAdminCourseDialog,
} from '@/workspaces/admin/components/course-dialogs'

const member = {
  id: '4c530c42-67bf-4cbe-a6f3-2c662564ddd1',
  userId: 'acace6a5-7430-4dbf-b327-d76f3d51542a',
  role: 'STUDENT',
  createdAt: '2026-07-01T10:00:00.000Z',
  user: {
    id: 'acace6a5-7430-4dbf-b327-d76f3d51542a',
    email: 'student@morshid.demo',
    displayName: 'Demo Student',
    role: 'STUDENT',
    status: 'ACTIVE',
  },
} as const

const course: CourseAdministration = {
  id: 'b3d1cf10-6f27-4f16-8b1b-8b4c5f4c1d9a',
  code: 'CS-201',
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
}

const managedUser: ManagedUser = {
  ...member.user,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-11T10:00:00.000Z',
  courseAssignments: {
    courseCount: 0,
    instructorCourseCount: 0,
    studentCourseCount: 0,
    courses: [],
  },
}

describe('Admin operation controls', () => {
  afterEach(cleanup)

  it('confirms removal of a course assignment', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn().mockResolvedValue(undefined)

    render(
      <AdminAssignmentsTable
        members={[member]}
        isPending={false}
        onRoleChange={vi.fn()}
        onRemove={onRemove}
      />,
    )

    await user.click(
      screen.getAllByRole('button', { name: 'Remove assignment' })[0],
    )
    expect(
      await screen.findByRole('heading', {
        name: 'Remove course assignment?',
      }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith(member.userId))
  })

  it('adds an eligible user to the selected course', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn().mockResolvedValue(undefined)

    render(
      <AddCourseMemberDialog
        users={[managedUser]}
        assignedUserIds={new Set()}
        isPending={false}
        onAdd={onAdd}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Add assignment' }))
    const userCheckbox = await screen.findByRole('checkbox', {
      name: /Demo Student/i,
    })
    await user.click(userCheckbox)
    await user.click(screen.getByRole('button', { name: 'Add assignment' }))

    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({
        userId: managedUser.id,
        role: 'STUDENT',
      }),
    )
  })

  it('assigns an instructor without showing a redundant role tab', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn().mockResolvedValue(undefined)

    const instructorUser: ManagedUser = {
      ...managedUser,
      id: 'd0c70000-0000-0000-0000-000000000001',
      displayName: 'Test Instructor',
      email: 'instructor@morshid.demo',
      role: 'INSTRUCTOR',
    }

    render(
      <AddCourseMemberDialog
        users={[instructorUser]}
        assignedUserIds={new Set()}
        isPending={false}
        defaultRole="INSTRUCTOR"
        onAdd={onAdd}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Add assignment' }))
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()

    const userCheckbox = await screen.findByRole('checkbox', {
      name: /Test Instructor/i,
    })
    await user.click(userCheckbox)
    await user.click(screen.getByRole('button', { name: 'Add assignment' }))

    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({
        userId: instructorUser.id,
        role: 'INSTRUCTOR',
      }),
    )
  })

  it('searches and assigns multiple users at the same time', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn().mockResolvedValue(undefined)

    const student1: ManagedUser = {
      ...managedUser,
      id: '11111111-1111-1111-1111-111111111111',
      displayName: 'Alice Johnson',
      email: 'alice@morshid.demo',
      role: 'STUDENT',
    }
    const student2: ManagedUser = {
      ...managedUser,
      id: '22222222-2222-2222-2222-222222222222',
      displayName: 'Bob Smith',
      email: 'bob@morshid.demo',
      role: 'STUDENT',
    }
    const student3: ManagedUser = {
      ...managedUser,
      id: '33333333-3333-3333-3333-333333333333',
      displayName: 'Charlie Davis',
      email: 'charlie@morshid.demo',
      role: 'STUDENT',
    }

    render(
      <AddCourseMemberDialog
        users={[student1, student2, student3]}
        assignedUserIds={new Set()}
        isPending={false}
        defaultRole="STUDENT"
        onAdd={onAdd}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Add assignment' }))

    // Test search filter
    const searchInput = screen.getByRole('textbox', { name: 'Search users' })
    await user.type(searchInput, 'Alice')
    expect(screen.getByText('Alice Johnson')).toBeVisible()
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument()

    // Select Alice
    await user.click(screen.getByRole('checkbox', { name: /Alice Johnson/i }))

    // Clear search and select Bob
    await user.clear(searchInput)
    expect(screen.getByText('Bob Smith')).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: /Bob Smith/i }))

    // Selected count indicator should show 2 selected
    expect(screen.getByText('2 selected')).toBeVisible()

    // Submit multi-user assignment
    await user.click(screen.getByRole('button', { name: 'Add assignment' }))

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({
        userId: student1.id,
        role: 'STUDENT',
      })
      expect(onAdd).toHaveBeenCalledWith({
        userId: student2.id,
        role: 'STUDENT',
      })
    })
  })

  it('changes the course role through the assignment edit dialog', async () => {
    const user = userEvent.setup()
    const onRoleChange = vi.fn()

    render(
      <AdminAssignmentsTable
        members={[member]}
        isPending={false}
        onRoleChange={onRoleChange}
        onRemove={vi.fn()}
      />,
    )

    // Open edit dialog
    const editButton = screen.getAllByRole('button', {
      name: `Edit assignment for ${member.user.displayName}`,
    })[0]
    await user.click(editButton)

    // Switch role to Instructor without adding another tab set to the dialog.
    await user.click(
      await screen.findByRole('combobox', { name: 'Assignment role' }),
    )
    await user.click(await screen.findByRole('option', { name: 'Instructor' }))

    // Submit update
    const submitButton = screen.getByRole('button', {
      name: 'Update assignment',
    })
    await user.click(submitButton)

    expect(onRoleChange).toHaveBeenCalledWith(member.userId, 'INSTRUCTOR')
  })

  it('directs password changes to the dedicated reset action in edit mode', async () => {
    const user = userEvent.setup()

    render(
      <UserActions
        user={managedUser}
        isResettingPassword={false}
        isUpdatingStatus={false}
        onResetPassword={vi.fn().mockResolvedValue(undefined)}
        onStatusChange={vi.fn().mockResolvedValue(undefined)}
        onUpdateUser={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit user' }))

    expect(
      await screen.findByRole('heading', { name: 'Update User' }),
    ).toBeVisible()
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument()
    expect(screen.getByText(/use reset password/i)).toBeVisible()
  })

  it('submits edited identity fields without a password from the edit user dialog', async () => {
    const user = userEvent.setup()
    const onUpdateUser = vi.fn().mockResolvedValue(undefined)

    render(
      <UserActions
        user={managedUser}
        isResettingPassword={false}
        isUpdatingStatus={false}
        onResetPassword={vi.fn().mockResolvedValue(undefined)}
        onStatusChange={vi.fn().mockResolvedValue(undefined)}
        onUpdateUser={onUpdateUser}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit user' }))
    const nameInput = await screen.findByRole('textbox', { name: 'Name' })
    await user.clear(nameInput)
    await user.type(nameInput, 'Renamed Student')
    await user.click(screen.getByRole('combobox', { name: 'Role' }))
    await user.click(await screen.findByRole('option', { name: 'Instructor' }))
    await user.click(screen.getByRole('button', { name: 'Update User' }))

    await waitFor(() =>
      expect(onUpdateUser).toHaveBeenCalledWith({
        name: 'Renamed Student',
        email: managedUser.email,
        password: '',
        role: 'INSTRUCTOR',
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Update User' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('keeps the edit user dialog open and reports a failed update', async () => {
    const user = userEvent.setup()
    const onUpdateUser = vi
      .fn()
      .mockRejectedValue(new Error('Email already in use'))

    render(
      <UserActions
        user={managedUser}
        isResettingPassword={false}
        isUpdatingStatus={false}
        onResetPassword={vi.fn().mockResolvedValue(undefined)}
        onStatusChange={vi.fn().mockResolvedValue(undefined)}
        onUpdateUser={onUpdateUser}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit user' }))
    await user.click(await screen.findByRole('button', { name: 'Update User' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email already in use',
    )
    expect(screen.getByRole('heading', { name: 'Update User' })).toBeVisible()
  })

  it('submits course edits through the edit course dialog', async () => {
    const user = userEvent.setup()
    const onUpdateCourse = vi.fn().mockResolvedValue(undefined)

    render(
      <EditAdminCourseDialog course={course} onUpdateCourse={onUpdateCourse} />,
    )

    await user.click(
      screen.getByRole('button', { name: `Edit course ${course.code}` }),
    )
    const titleInput = await screen.findByRole('textbox', {
      name: 'Course Title',
    })
    await user.clear(titleInput)
    await user.type(titleInput, 'Advanced Data Structures')
    await user.click(screen.getByRole('button', { name: 'Update Course' }))

    await waitFor(() =>
      expect(onUpdateCourse).toHaveBeenCalledWith({
        code: course.code,
        title: 'Advanced Data Structures',
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Update Course' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('clears a failed update-course error before the dialog is reopened', async () => {
    const user = userEvent.setup()
    const onUpdateCourse = vi
      .fn()
      .mockRejectedValueOnce(new Error('Course code already exists'))
      .mockResolvedValue(undefined)

    render(
      <EditAdminCourseDialog course={course} onUpdateCourse={onUpdateCourse} />,
    )

    const trigger = screen.getByRole('button', {
      name: `Edit course ${course.code}`,
    })
    await user.click(trigger)
    await user.click(
      await screen.findByRole('button', { name: 'Update Course' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Course code already exists',
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(
      screen.getByRole('button', { name: `Edit course ${course.code}` }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Update Course' }),
    ).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears a failed create-course error before the dialog is reopened', async () => {
    const user = userEvent.setup()
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(new Error('Course code already exists'))
      .mockResolvedValue(undefined)

    render(<CreateAdminCourseDialog onCreateCourse={onCreate} />)

    await user.click(screen.getByRole('button', { name: 'Create Course' }))
    await user.type(screen.getByRole('textbox', { name: 'Course Code' }), 'CS')
    await user.type(
      screen.getByRole('textbox', { name: 'Course Title' }),
      'Course',
    )
    await user.click(screen.getByRole('button', { name: 'Create Course' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Course code already exists',
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Create Course' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
