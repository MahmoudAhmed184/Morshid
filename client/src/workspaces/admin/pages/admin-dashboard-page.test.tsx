import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuditEvent } from '@/features/audit/audit.schema'
import type { CourseAdministration } from '@/features/courses/course-administration.schema'
import type { ManagedUser } from '@/features/user-management/managed-user.schema'
import { useAudit } from '@/workspaces/admin/audit/use-audit'
import { useCourseAdministration } from '@/workspaces/admin/use-course-administration'
import { useManagedUsers } from '@/workspaces/admin/users/use-user-management'
import { AdminDashboardPage } from './admin-dashboard-page'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children?: React.ReactNode
    to: string
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/workspaces/admin/audit/use-audit')
vi.mock('@/workspaces/admin/use-course-administration')
vi.mock('@/workspaces/admin/users/use-user-management')

const useAuditMock = vi.mocked(useAudit)
const useCourseAdministrationMock = vi.mocked(useCourseAdministration)
const useManagedUsersMock = vi.mocked(useManagedUsers)

const sampleUsers: ManagedUser[] = [
  {
    id: 'user-1',
    email: 'student@morshid.demo',
    displayName: 'Student One',
    role: 'STUDENT',
    status: 'ACTIVE',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-11T10:00:00.000Z',
    courseAssignments: {
      courseCount: 1,
      instructorCourseCount: 0,
      studentCourseCount: 1,
      courses: [],
    },
  },
  {
    id: 'user-2',
    email: 'instructor@morshid.demo',
    displayName: 'Instructor One',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-11T10:00:00.000Z',
    courseAssignments: {
      courseCount: 1,
      instructorCourseCount: 1,
      studentCourseCount: 0,
      courses: [],
    },
  },
]

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
      memberCount: 2,
      instructorCount: 1,
      studentCount: 1,
      materialCount: 0,
      activeMaterialCount: 0,
    },
  },
]

const sampleEvents: AuditEvent[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    action: 'admin.account_created',
    actorUserId: 'admin-1',
    actor: {
      id: 'admin-1',
      displayName: 'Admin User',
      email: 'admin@morshid.demo',
    },
    targetType: 'user',
    targetId: 'user-1',
    courseId: null,
    createdAt: '2026-08-19T10:00:00.000Z',
  },
]

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useManagedUsersMock.mockReturnValue({
      data: { pages: [{ users: sampleUsers }] },
      isPending: false,
      isError: false,
      isFetching: false,
    } as any)
    useCourseAdministrationMock.mockReturnValue({
      data: sampleCourses,
      isPending: false,
      isError: false,
      isFetching: false,
    } as any)
    useAuditMock.mockReturnValue({
      data: {
        events: sampleEvents,
        total: 1,
        page: 1,
        limit: 5,
        totalPages: 1,
      },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any)
  })

  afterEach(cleanup)

  it('renders dashboard metrics and quick navigation', () => {
    render(<AdminDashboardPage />)

    expect(
      screen.getByRole('heading', { name: 'System overview.' }),
    ).toBeVisible()
    expect(screen.getByText('Quick navigation')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Recent activity' }),
    ).toBeVisible()

    // Metrics
    expect(screen.getAllByText('Students').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Instructors').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Courses').length).toBeGreaterThanOrEqual(1)

    // Quick navigation buttons
    expect(screen.getByRole('link', { name: /Students/ })).toBeVisible()
    expect(screen.getByRole('link', { name: /Courses/ })).toBeVisible()
    expect(screen.getByRole('link', { name: /Audit Logs/ })).toBeVisible()
  })

  it('renders recent audit events list', () => {
    render(<AdminDashboardPage />)

    expect(screen.getByText('admin account_created')).toBeVisible()
    expect(screen.getByText(/Admin User/)).toBeVisible()
  })

  it('renders empty state when no recent audit activity exists', () => {
    useAuditMock.mockReturnValue({
      data: { events: [], total: 0, page: 1, limit: 5, totalPages: 1 },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any)

    render(<AdminDashboardPage />)

    expect(screen.getByText('No audit activity')).toBeVisible()
  })
})
