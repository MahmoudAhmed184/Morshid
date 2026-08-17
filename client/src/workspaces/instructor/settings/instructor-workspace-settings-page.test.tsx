import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCourseMembership } from '@/workspaces/instructor/use-course-membership'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { writeInstructorPreferences } from '@/workspaces/instructor/preferences/instructor-workspace-preferences.storage'
import { InstructorWorkspaceSettingsPage } from './instructor-workspace-settings-page'

vi.mock('@/workspaces/instructor/use-course-membership')

const useCourseMembershipMock = vi.mocked(useCourseMembership)

const testUserId = 'instructor-user-id-123'
const sampleCourses = [
  {
    id: 'course-101',
    code: 'CS-101',
    title: 'Intro to Programming',
    membershipRole: 'INSTRUCTOR' as const,
    canManageMaterials: true,
  },
  {
    id: 'course-201',
    code: 'CS-201',
    title: 'Data Structures',
    membershipRole: 'INSTRUCTOR' as const,
    canManageMaterials: true,
  },
]

describe('InstructorWorkspaceSettingsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    window.localStorage.clear()
    useAuthStore.setState({
      user: {
        id: testUserId,
        email: 'instructor@morshid.test',
        displayName: 'Test Instructor',
        role: 'INSTRUCTOR',
        status: 'ACTIVE',
      },
      tokenType: 'Bearer',
      accessToken: 'test-token',
      accessTokenExpiresAt: '2026-08-16T12:00:00.000Z',
      isAuthenticated: true,
      sessionVersion: 1,
    })

    useCourseMembershipMock.mockReturnValue({
      data: sampleCourses,
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useCourseMembership>)
  })

  afterEach(cleanup)

  it('renders workspace settings with default course selection and empty presets state', () => {
    render(<InstructorWorkspaceSettingsPage />)

    expect(screen.getByText('Default Active Course')).toBeVisible()
    expect(screen.getByText('Saved Review Queue Presets')).toBeVisible()
    expect(screen.getByText('0 / 10 presets')).toBeVisible()
    expect(screen.getByText('No saved presets yet')).toBeVisible()
  })

  it('renders saved filter presets with criteria badges', () => {
    writeInstructorPreferences(testUserId, {
      activeCourseId: 'course-101',
      savedFilters: [
        {
          id: 'filter-alpha',
          name: 'Pending CS-101',
          criteria: {
            status: 'PENDING',
            courseId: 'course-101',
            trigger: 'STUDENT_REQUEST',
          },
          createdAt: '2026-08-16T00:00:00.000Z',
        },
      ],
    })

    render(<InstructorWorkspaceSettingsPage />)

    expect(screen.getByText('1 / 10 presets')).toBeVisible()
    expect(screen.getByText('Pending CS-101')).toBeVisible()
    expect(screen.getByText('Status: PENDING')).toBeVisible()
    expect(screen.getByText('Course: CS-101')).toBeVisible()
    expect(screen.getByText('Trigger: STUDENT_REQUEST')).toBeVisible()
  })

  it('allows renaming a saved filter preset', async () => {
    writeInstructorPreferences(testUserId, {
      activeCourseId: null,
      savedFilters: [
        {
          id: 'filter-alpha',
          name: 'Old Name',
          criteria: { status: 'RESOLVED' },
          createdAt: '2026-08-16T00:00:00.000Z',
        },
      ],
    })

    const user = userEvent.setup()
    render(<InstructorWorkspaceSettingsPage />)

    const renameBtn = screen.getByRole('button', { name: 'Rename Old Name' })
    await user.click(renameBtn)

    expect(screen.getByText('Rename Filter Preset')).toBeVisible()
    const input = screen.getByPlaceholderText('Filter preset name')
    await user.clear(input)
    await user.type(input, 'New Renamed Filter')

    const saveChangesBtn = screen.getByRole('button', { name: 'Save changes' })
    await user.click(saveChangesBtn)

    expect(screen.getByText('New Renamed Filter')).toBeVisible()
  })

  it('allows deleting a saved filter preset after confirmation', async () => {
    writeInstructorPreferences(testUserId, {
      activeCourseId: null,
      savedFilters: [
        {
          id: 'filter-alpha',
          name: 'Filter To Delete',
          criteria: { status: 'RESOLVED' },
          createdAt: '2026-08-16T00:00:00.000Z',
        },
      ],
    })

    const user = userEvent.setup()
    render(<InstructorWorkspaceSettingsPage />)

    const deleteBtn = screen.getByRole('button', {
      name: 'Delete Filter To Delete',
    })
    await user.click(deleteBtn)

    expect(screen.getByText('Delete "Filter To Delete"?')).toBeVisible()

    const confirmBtn = screen.getByRole('button', { name: 'Delete preset' })
    await user.click(confirmBtn)

    expect(screen.getByText('No saved presets yet')).toBeVisible()
    expect(screen.getByText('0 / 10 presets')).toBeVisible()
  })
})
