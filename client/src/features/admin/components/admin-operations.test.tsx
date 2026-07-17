import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AdminManagedUser } from '@/features/admin/schemas/admin-managed-user.schema'

import { AddCourseMemberDialog } from './add-course-member-dialog'
import { AdminAssignmentsTable } from './admin-assignments-table'
import { EditAdminMaterialDialog } from './edit-admin-material-dialog'

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

const material = {
  id: '4c530c42-67bf-4cbe-a6f3-2c662564ddd1',
  courseId: 'acace6a5-7430-4dbf-b327-d76f3d51542a',
  uploadedById: '9e011f19-1197-42f4-9f7a-6c753cf9e82d',
  uploadedBy: {
    id: '9e011f19-1197-42f4-9f7a-6c753cf9e82d',
    email: 'instructor@morshid.demo',
    displayName: 'Demo Instructor',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
  },
  title: 'Python Basics',
  originalFilename: 'python-basics.pdf',
  storagePath: '/materials/python-basics.pdf',
  sha256Hash: null,
  status: 'READY',
  extractedTextLength: 1200,
  chunkCount: 8,
  errorMessage: null,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-11T10:00:00.000Z',
} as const

const managedUser: AdminManagedUser = {
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

    await user.click(screen.getByRole('button', { name: 'Remove assignment' }))
    expect(
      await screen.findByRole('heading', {
        name: 'Remove course assignment?',
      }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith(member.userId))
  })

  it('submits edited material metadata through the visible form', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <EditAdminMaterialDialog
        material={material}
        isPending={false}
        onSave={onSave}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit material' }))
    const titleInput = await screen.findByRole('textbox', { name: 'Title' })
    await user.clear(titleInput)
    await user.type(titleInput, '  Python Functions  ')
    await user.click(screen.getByRole('button', { name: 'Save title' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Python Functions'))
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Edit material metadata' }),
      ).not.toBeInTheDocument(),
    )
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
    const userSelect = await screen.findByRole('combobox', { name: 'User' })
    userSelect.focus()
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('button', { name: 'Add assignment' }))

    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({
        userId: managedUser.id,
        role: 'STUDENT',
      }),
    )
  })

  it('changes the course role through the assignment table', async () => {
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

    const roleSelect = screen.getByRole('combobox', {
      name: 'Course role for Demo Student',
    })
    roleSelect.focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(onRoleChange).toHaveBeenCalledWith(member.userId, 'INSTRUCTOR')
  })
})
