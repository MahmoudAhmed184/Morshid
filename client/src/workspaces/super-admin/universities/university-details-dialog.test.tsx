import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UniversityItem } from '@/features/universities/universities.schema'
import { UniversityDetailsDialog } from './university-details-dialog'

const mockUniversity: UniversityItem = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'King Saud University',
  code: 'KSU',
  status: 'ACTIVE',
  owner: {
    id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    displayName: 'Dr. Fatima Al-Otaibi',
    email: 'admin@ksu.edu.sa',
    status: 'ACTIVE',
  },
  studentsCount: 1250,
  instructorsCount: 45,
  coursesCount: 30,
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-20T12:00:00.000Z',
}

describe('UniversityDetailsDialog', () => {
  afterEach(cleanup)

  it('renders university details, metrics, and owner information', () => {
    render(
      <UniversityDetailsDialog
        university={mockUniversity}
        open={true}
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.getByText('King Saud University')).toBeInTheDocument()
    expect(screen.getByText('KSU')).toBeInTheDocument()
    expect(screen.getByText('Dr. Fatima Al-Otaibi')).toBeInTheDocument()
    expect(screen.getByText('admin@ksu.edu.sa')).toBeInTheDocument()
    expect(screen.getByText('1250')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('triggers action callbacks when buttons are clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onChangeStatus = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <UniversityDetailsDialog
        university={mockUniversity}
        open={true}
        onOpenChange={onOpenChange}
        onEdit={onEdit}
        onChangeStatus={onChangeStatus}
      />,
    )

    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledWith(mockUniversity)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
