import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CourseAdministration } from '@/features/courses/course-administration.schema'
import type { MaterialAdministration } from '@/features/materials/material-administration.schema'
import {
  useCourseAdministration,
  useCourseAdministrationMutations,
  useMaterialAdministration,
} from '@/workspaces/admin/use-course-administration'
import { AdminMaterialsPage } from './admin-materials-page'

vi.mock('@/workspaces/admin/use-course-administration')

const useCourseAdministrationMock = vi.mocked(useCourseAdministration)
const useMaterialAdministrationMock = vi.mocked(useMaterialAdministration)
const useCourseAdministrationMutationsMock = vi.mocked(
  useCourseAdministrationMutations,
)

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
      memberCount: 0,
      instructorCount: 0,
      studentCount: 0,
      materialCount: 2,
      activeMaterialCount: 1,
    },
  },
  {
    id: 'course-2',
    code: 'CS102',
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
  },
]

const sampleMaterials: MaterialAdministration[] = [
  {
    id: 'mat-1',
    courseId: 'course-1',
    uploadedBy: {
      email: 'instructor@morshid.demo',
      displayName: 'Demo Instructor',
    },
    title: 'Syllabus and Schedule',
    originalFilename: 'syllabus.pdf',
    status: 'READY',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-11T10:00:00.000Z',
  },
  {
    id: 'mat-2',
    courseId: 'course-1',
    uploadedBy: {
      email: 'instructor@morshid.demo',
      displayName: 'Demo Instructor',
    },
    title: 'Lecture 1 Slides',
    originalFilename: 'lecture-1.pdf',
    status: 'PROCESSING',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-11T10:00:00.000Z',
  },
  {
    id: 'mat-3',
    courseId: 'course-1',
    uploadedBy: {
      email: 'instructor@morshid.demo',
      displayName: 'Demo Instructor',
    },
    title: 'Broken Document',
    originalFilename: 'corrupted.pdf',
    status: 'FAILED',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-11T10:00:00.000Z',
  },
]

function mockCoursesQuery(courses: CourseAdministration[] = sampleCourses) {
  return {
    data: courses,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useCourseAdministration>
}

function mockMaterialsQuery(
  materials: MaterialAdministration[] = sampleMaterials,
) {
  return {
    data: { pages: [{ materials }] },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useMaterialAdministration>
}

describe('AdminMaterialsPage status filtering and search', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useCourseAdministrationMock.mockReturnValue(mockCoursesQuery())
    useMaterialAdministrationMock.mockReturnValue(mockMaterialsQuery())
    useCourseAdministrationMutationsMock.mockReturnValue({
      createCourse: { mutateAsync: vi.fn(), isPending: false } as any,
      updateCourse: { mutateAsync: vi.fn(), isPending: false } as any,
      deleteCourse: { mutateAsync: vi.fn(), isPending: false } as any,
      editMaterial: { mutateAsync: vi.fn(), isPending: false } as any,
      deleteMaterial: { mutateAsync: vi.fn(), isPending: false } as any,
      addMember: { mutateAsync: vi.fn(), isPending: false } as any,
      addMembers: { mutateAsync: vi.fn(), isPending: false } as any,
      updateMemberRole: { mutateAsync: vi.fn(), isPending: false } as any,
      removeMember: { mutateAsync: vi.fn(), isPending: false } as any,
    })
  })

  afterEach(cleanup)

  it('renders all materials by default with status filter control', () => {
    render(<AdminMaterialsPage />)

    expect(
      screen.getByRole('heading', { name: 'Material Metadata' }),
    ).toBeVisible()
    expect(screen.getByPlaceholderText('Search materials...')).toBeVisible()
    expect(
      screen.getByRole('combobox', { name: 'Filter materials by status' }),
    ).toBeVisible()
    expect(
      screen.getAllByText('Syllabus and Schedule').length,
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByText('Lecture 1 Slides').length,
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByText('Broken Document').length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('filters materials by status (Ready, Processing, Failed)', async () => {
    const user = userEvent.setup()
    render(<AdminMaterialsPage />)

    const statusSelect = screen.getByRole('combobox', {
      name: 'Filter materials by status',
    })
    await user.click(statusSelect)
    await user.click(await screen.findByRole('option', { name: 'Ready' }))

    expect(
      screen.getAllByText('Syllabus and Schedule').length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Lecture 1 Slides')).not.toBeInTheDocument()
    expect(screen.queryByText('Broken Document')).not.toBeInTheDocument()

    await user.click(statusSelect)
    await user.click(await screen.findByRole('option', { name: 'Failed' }))

    expect(
      screen.getAllByText('Broken Document').length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Syllabus and Schedule')).not.toBeInTheDocument()
    expect(screen.queryByText('Lecture 1 Slides')).not.toBeInTheDocument()
  })

  it('resets search and status filter when switching courses', async () => {
    const user = userEvent.setup()
    render(<AdminMaterialsPage />)

    const searchInput = screen.getByPlaceholderText('Search materials...')
    await user.type(searchInput, 'Syllabus')
    expect(searchInput).toHaveValue('Syllabus')

    const statusSelect = screen.getByRole('combobox', {
      name: 'Filter materials by status',
    })
    await user.click(statusSelect)
    await user.click(await screen.findByRole('option', { name: 'Ready' }))

    const courseSelect = screen.getByRole('combobox', { name: 'Course' })
    await user.click(courseSelect)
    await user.click(
      await screen.findByRole('option', {
        name: 'CS102 — Data Structures',
      }),
    )

    expect(searchInput).toHaveValue('')
    expect(statusSelect).toHaveTextContent('All statuses')
  })

  it('shows distinct empty state when filters match no materials', async () => {
    useMaterialAdministrationMock.mockReturnValue(
      mockMaterialsQuery(sampleMaterials.slice(0, 1)),
    )
    const user = userEvent.setup()
    render(<AdminMaterialsPage />)

    expect(
      screen.getAllByText('Syllabus and Schedule').length,
    ).toBeGreaterThanOrEqual(1)

    const statusSelect = screen.getByRole('combobox', {
      name: 'Filter materials by status',
    })
    await user.click(statusSelect)
    await user.click(await screen.findByRole('option', { name: 'Failed' }))

    expect(screen.getByText('No matching materials')).toBeVisible()
    expect(
      screen.getByText('Try changing your search or status filter.'),
    ).toBeVisible()
  })
})
