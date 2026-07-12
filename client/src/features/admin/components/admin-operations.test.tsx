import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

describe('Admin operation controls', () => {
  afterEach(cleanup)

  it('confirms removal of a course assignment', async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined)

    render(
      <AdminAssignmentsTable
        members={[member]}
        isPending={false}
        onRoleChange={vi.fn()}
        onRemove={onRemove}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove assignment' }))
    expect(
      await screen.findByRole('heading', {
        name: 'Remove course assignment?',
      }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith(member.userId))
  })

  it('submits edited material metadata through the visible form', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <EditAdminMaterialDialog
        material={material}
        isPending={false}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit material' }))
    const titleInput = await screen.findByRole('textbox', { name: 'Title' })
    fireEvent.change(titleInput, { target: { value: '  Python Functions  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save title' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Python Functions'))
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Edit material metadata' }),
      ).not.toBeInTheDocument(),
    )
  })
})
