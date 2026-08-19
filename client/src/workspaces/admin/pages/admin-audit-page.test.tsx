import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAudit } from '@/workspaces/admin/audit/use-audit'
import type { AuditEvent } from '@/features/audit/audit.schema'
import { AdminAuditPage } from './admin-audit-page'

vi.mock('@/workspaces/admin/audit/use-audit')

const useAuditMock = vi.mocked(useAudit)

const sampleEvents: AuditEvent[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    action: 'user.create',
    actorUserId: 'admin-1',
    actor: {
      id: 'admin-1',
      displayName: 'Admin User',
      email: 'admin@morshid.demo',
    },
    targetType: 'USER',
    targetId: 'user-1',
    courseId: null,
    createdAt: '2026-07-11T12:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    action: 'course.create',
    actorUserId: 'admin-1',
    actor: {
      id: 'admin-1',
      displayName: 'Admin User',
      email: 'admin@morshid.demo',
    },
    targetType: 'COURSE',
    targetId: 'course-1',
    courseId: 'course-1',
    createdAt: '2026-07-11T13:00:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    action: 'material.upload',
    actorUserId: 'instructor-1',
    actor: {
      id: 'instructor-1',
      displayName: 'Instructor Jane',
      email: 'jane@morshid.demo',
    },
    targetType: 'MATERIAL',
    targetId: 'mat-1',
    courseId: 'course-1',
    createdAt: '2026-07-11T14:00:00.000Z',
  },
]

function mockQueryResult(data: AuditEvent[] | undefined, overrides = {}) {
  return {
    data,
    error: null,
    isError: false,
    isFetching: false,
    isPending: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAudit>
}

describe('AdminAuditPage search and filtering', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(cleanup)

  it('renders audit events and search controls', () => {
    useAuditMock.mockReturnValue(mockQueryResult(sampleEvents))

    render(<AdminAuditPage />)

    expect(
      screen.getByRole('heading', { name: 'Recent Audit Activity' }),
    ).toBeVisible()
    expect(screen.getByPlaceholderText(/Search audit events/i)).toBeVisible()
    expect(
      screen.getByRole('combobox', {
        name: 'Filter audit events by target type',
      }),
    ).toBeVisible()
    expect(screen.getAllByText('user.create').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('course.create').length).toBeGreaterThanOrEqual(
      1,
    )
    expect(
      screen.getAllByText('material.upload').length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('filters audit events by search keyword', async () => {
    useAuditMock.mockReturnValue(mockQueryResult(sampleEvents))
    const user = userEvent.setup()

    render(<AdminAuditPage />)
    const searchInput = screen.getByPlaceholderText(/Search audit events/i)
    await user.type(searchInput, 'syllabus')

    expect(screen.queryByText('user.create')).not.toBeInTheDocument()
    expect(screen.queryByText('course.create')).not.toBeInTheDocument()

    await user.clear(searchInput)
    await user.type(searchInput, 'Jane')

    expect(
      screen.getAllByText('material.upload').length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('user.create')).not.toBeInTheDocument()
  })

  it('filters audit events by target type', async () => {
    useAuditMock.mockReturnValue(mockQueryResult(sampleEvents))
    const user = userEvent.setup()

    render(<AdminAuditPage />)

    const targetTypeSelect = screen.getByRole('combobox', {
      name: 'Filter audit events by target type',
    })
    await user.click(targetTypeSelect)
    await user.click(await screen.findByRole('option', { name: 'USER' }))

    expect(screen.getAllByText('user.create').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('course.create')).not.toBeInTheDocument()
    expect(screen.queryByText('material.upload')).not.toBeInTheDocument()
  })

  it('shows appropriate empty states for no events vs no filter matches', async () => {
    useAuditMock.mockReturnValue(mockQueryResult([]))

    const { rerender } = render(<AdminAuditPage />)
    expect(screen.getByText('No audit events found')).toBeVisible()

    useAuditMock.mockReturnValue(mockQueryResult(sampleEvents))
    rerender(<AdminAuditPage />)

    const user = userEvent.setup()
    const searchInput = screen.getByPlaceholderText(/Search audit events/i)
    await user.type(searchInput, 'nonexistent query')

    expect(screen.getByText('No matching audit events')).toBeVisible()
    expect(
      screen.getByText('Try adjusting your search or target type filter.'),
    ).toBeVisible()
  })
})
