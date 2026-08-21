import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UsersTable } from './users-table'
import type { ManagedUser } from '@/features/user-management/managed-user.schema'

const student: ManagedUser = {
  id: 'acace6a5-7430-4dbf-b327-d76f3d51542a',
  email: 'student@morshid.demo',
  displayName: 'Demo Student',
  role: 'STUDENT',
  status: 'ACTIVE',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-11T10:00:00.000Z',
  courseAssignments: {
    courseCount: 0,
    instructorCourseCount: 0,
    studentCourseCount: 0,
    courses: [],
  },
}

describe('UsersTable selection', () => {
  afterEach(cleanup)

  it('supports selecting an individual row without a select-all control', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()

    render(
      <UsersTable
        users={[student]}
        selectedUserIds={new Set()}
        isResettingPassword={false}
        isUpdatingStatus={false}
        onSelectionChange={onSelectionChange}
        onResetPassword={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )

    await user.click(
      screen.getAllByRole('checkbox', { name: 'Select Demo Student' })[0],
    )

    expect(onSelectionChange).toHaveBeenCalledWith(student.id, true)
    expect(
      screen.queryByRole('checkbox', { name: 'Select all users' }),
    ).not.toBeInTheDocument()
  })
})
