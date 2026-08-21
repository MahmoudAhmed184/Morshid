import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { AdminAuditPage } from './admin-audit-page'

const sampleEvents = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    actorUserId: '00000000-0000-4000-8000-000000000002',
    action: 'admin.account_created',
    targetType: 'user',
    targetId: '00000000-0000-4000-8000-000000000003',
    courseId: null,
    createdAt: '2026-08-19T10:00:00.000Z',
    actor: {
      id: '00000000-0000-4000-8000-000000000002',
      email: 'admin@morshid.demo',
      displayName: 'Admin User',
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    actorUserId: null,
    action: 'auth.login_failed',
    targetType: 'auth_session',
    targetId: null,
    courseId: null,
    createdAt: '2026-08-19T09:00:00.000Z',
    actor: null,
  },
]

describe('AdminAuditPage', () => {
  let queryClient: QueryClient
  let capturedUrls: string[]

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    capturedUrls = []

    useAuthStore.setState({
      user: {
        id: '00000000-0000-4000-8000-000000000002',
        email: 'admin@morshid.demo',
        displayName: 'Admin User',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      isAuthenticated: true,
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        capturedUrls.push(url)

        if (url.includes('/api/v1/admin/courses')) {
          return Response.json({
            courses: [
              {
                id: '00000000-0000-4000-8000-000000000101',
                code: 'CS101',
                title: 'Intro to Computer Science',
                adminMetadata: {
                  materialCount: 5,
                  memberCount: 20,
                  studentCount: 18,
                  instructorCount: 2,
                },
              },
            ],
          })
        }

        if (url.includes('/api/v1/admin/users')) {
          return Response.json({
            users: [
              {
                id: '00000000-0000-4000-8000-000000000002',
                email: 'admin@morshid.demo',
                displayName: 'Admin User',
                role: 'ADMIN',
                status: 'ACTIVE',
                createdAt: '2026-07-01T00:00:00.000Z',
                updatedAt: '2026-07-01T00:00:00.000Z',
                courseAssignments: {
                  courseCount: 0,
                  instructorCourseCount: 0,
                  studentCourseCount: 0,
                  courses: [],
                },
              },
            ],
            nextCursor: null,
          })
        }

        if (url.includes('/api/v1/admin/audit')) {
          return Response.json({
            events: sampleEvents,
            total: 2,
            page: 1,
            limit: 20,
            totalPages: 1,
          })
        }

        return Response.json({})
      }),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <AdminAuditPage />
      </QueryClientProvider>,
    )
  }

  it('renders page header, audit events table, and pagination controls', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Recent Audit Activity' }),
    ).toBeInTheDocument()
    expect(screen.getByText('RBAC monitored')).toBeInTheDocument()

    const eventElements = await screen.findAllByText('admin.account_created')
    expect(eventElements.length).toBeGreaterThan(0)
    expect(screen.getAllByText('auth.login_failed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Admin User').length).toBeGreaterThan(0)
    expect(screen.getAllByText('System').length).toBeGreaterThan(0)

    expect(
      screen.getByRole('navigation', { name: 'Pagination' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Showing/)).toBeInTheDocument()
  })

  it('opens event details dialog when clicking view action button', async () => {
    const user = userEvent.setup()
    renderPage()

    const viewButtons = await screen.findAllByRole('button', {
      name: 'View event details',
    })
    expect(viewButtons.length).toBeGreaterThan(0)
    await user.click(viewButtons[0])

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Audit Event Details' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('00000000-0000-4000-8000-000000000003'),
    ).toBeInTheDocument()
  })

  it('queries with search parameter when user enters search term', async () => {
    const user = userEvent.setup()
    renderPage()

    const searchInput = await screen.findByPlaceholderText(
      'Search actor, event, target...',
    )
    await user.type(searchInput, 'account_created')

    await waitFor(
      () => {
        const hasSearchQuery = capturedUrls.some((url) =>
          url.includes('search=account_created'),
        )
        expect(hasSearchQuery).toBe(true)
      },
      { timeout: 2000 },
    )
  })

  it('shows clear filters button when filter is active and resets criteria on click', async () => {
    const user = userEvent.setup()
    renderPage()

    const searchInput = await screen.findByPlaceholderText(
      'Search actor, event, target...',
    )
    await user.type(searchInput, 'admin')

    const clearButton = await screen.findByRole('button', {
      name: 'Clear filters',
    })
    expect(clearButton).toBeInTheDocument()

    await user.click(clearButton)
    expect(searchInput).toHaveValue('')
  })

  it('renders date range filter trigger with presets', async () => {
    renderPage()

    const dateTrigger = await screen.findByRole('combobox', {
      name: 'Date Range',
    })
    expect(dateTrigger).toBeInTheDocument()
    expect(dateTrigger).toHaveTextContent('All time')
  })
})
