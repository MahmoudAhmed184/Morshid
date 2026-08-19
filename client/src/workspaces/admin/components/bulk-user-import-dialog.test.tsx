import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveCourseMembers } from '@/features/courses/course-administration.api'
import type { CourseAdministration } from '@/features/courses/course-administration.schema'

import { BulkUserImportDialog } from './bulk-user-import-dialog'

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

describe('BulkUserImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('disables the resolve button when input is empty', () => {
    render(
      <BulkUserImportDialog
        open={true}
        onOpenChange={vi.fn()}
        role="STUDENT"
        selectedCourseIds={new Set([course.id])}
        courses={[course]}
        maxUserSelections={500}
        currentSelectedCount={0}
        onApply={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: /resolve students/i }),
    ).toBeDisabled()
  })

  it('handles CSV upload and resolves identifiers from CSV', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const onOpenChange = vi.fn()
    const resolveCourseMembersMock = vi.mocked(resolveCourseMembers)

    resolveCourseMembersMock.mockResolvedValue({
      resolved: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          email: 'student1@morshid.demo',
          displayName: 'Student One',
          role: 'STUDENT',
          matchedBy: 'student1@morshid.demo',
          alreadyAssignedCourseIds: [],
        },
      ],
      unmatched: [],
      duplicates: [],
    })

    render(
      <BulkUserImportDialog
        open={true}
        onOpenChange={onOpenChange}
        role="STUDENT"
        selectedCourseIds={new Set([course.id])}
        courses={[course]}
        maxUserSelections={500}
        currentSelectedCount={0}
        onApply={onApply}
      />,
    )

    // Switch to CSV tab
    await user.click(screen.getByRole('tab', { name: /upload csv/i }))

    // Upload file
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    expect(fileInput).toBeInTheDocument()

    const file = new File(['email\nstudent1@morshid.demo\n'], 'students.csv', {
      type: 'text/csv',
    })
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(await screen.findByText(/1 identifier parsed/i)).toBeInTheDocument()

    // Resolve
    await user.click(screen.getByRole('button', { name: /resolve students/i }))

    // Preview
    expect(await screen.findByText('Student One')).toBeInTheDocument()
    expect(screen.getByText('Valid active students')).toBeInTheDocument()

    // Apply
    await user.click(
      screen.getByRole('button', { name: /add 1 students to selection/i }),
    )

    expect(onApply).toHaveBeenCalledWith([
      expect.objectContaining({ id: '10000000-0000-4000-8000-000000000001' }),
    ])
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('displays warning when matched users exceed selection limit', async () => {
    const user = userEvent.setup()
    const resolveCourseMembersMock = vi.mocked(resolveCourseMembers)

    resolveCourseMembersMock.mockResolvedValue({
      resolved: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          email: 'student1@morshid.demo',
          displayName: 'Student One',
          role: 'STUDENT',
          matchedBy: 'student1@morshid.demo',
          alreadyAssignedCourseIds: [],
        },
        {
          id: '10000000-0000-4000-8000-000000000002',
          email: 'student2@morshid.demo',
          displayName: 'Student Two',
          role: 'STUDENT',
          matchedBy: 'student2@morshid.demo',
          alreadyAssignedCourseIds: [],
        },
      ],
      unmatched: [],
      duplicates: [],
    })

    render(
      <BulkUserImportDialog
        open={true}
        onOpenChange={vi.fn()}
        role="STUDENT"
        selectedCourseIds={new Set([course.id])}
        courses={[course]}
        maxUserSelections={1} // limit = 1
        currentSelectedCount={0}
        onApply={vi.fn()}
      />,
    )

    const textarea = screen.getByPlaceholderText(/student1@morshid.demo/i)
    fireEvent.change(textarea, {
      target: { value: 'student1@morshid.demo\nstudent2@morshid.demo' },
    })

    await user.click(screen.getByRole('button', { name: /resolve students/i }))

    expect(
      await screen.findByText(/exceeds the selection limit of 1/i),
    ).toBeInTheDocument()

    // Apply button is disabled
    expect(
      screen.getByRole('button', { name: /add 2 students to selection/i }),
    ).toBeDisabled()
  })

  it('handles resolve error gracefully', async () => {
    const user = userEvent.setup()
    const resolveCourseMembersMock = vi.mocked(resolveCourseMembers)

    resolveCourseMembersMock.mockRejectedValue(
      new Error('Network connectivity issue'),
    )

    render(
      <BulkUserImportDialog
        open={true}
        onOpenChange={vi.fn()}
        role="STUDENT"
        selectedCourseIds={new Set([course.id])}
        courses={[course]}
        maxUserSelections={500}
        currentSelectedCount={0}
        onApply={vi.fn()}
      />,
    )

    const textarea = screen.getByPlaceholderText(/student1@morshid.demo/i)
    fireEvent.change(textarea, {
      target: { value: 'student1@morshid.demo' },
    })

    await user.click(screen.getByRole('button', { name: /resolve students/i }))

    expect(
      await screen.findByText('Network connectivity issue'),
    ).toBeInTheDocument()
  })

  it('renders role-specific example placeholder for instructors', () => {
    render(
      <BulkUserImportDialog
        open={true}
        onOpenChange={vi.fn()}
        role="INSTRUCTOR"
        selectedCourseIds={new Set([course.id])}
        courses={[course]}
        maxUserSelections={500}
        currentSelectedCount={0}
        onApply={vi.fn()}
      />,
    )

    expect(
      screen.getByPlaceholderText(/instructor1@morshid.demo/i),
    ).toBeInTheDocument()
  })
})
