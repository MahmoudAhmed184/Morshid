import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UniversityItem } from '@/features/universities/universities.schema'
import { UniversitiesPage } from './universities-page'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children?: React.ReactNode
    to: string
    params?: Record<string, string>
  }) => {
    let href = to
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`$${key}`, value)
      }
    }
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { back: vi.fn() } }),
}))

const sampleUniversity: UniversityItem = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'King Saud University',
  code: 'KSU',
  status: 'ACTIVE',
  owner: {
    id: '00000000-0000-4000-8000-000000000002',
    displayName: 'Dr. Fatima',
    email: 'fatima@ksu.edu.sa',
    status: 'ACTIVE',
  },
  studentsCount: 1200,
  instructorsCount: 80,
  coursesCount: 45,
  createdAt: '2026-08-19T10:00:00.000Z',
  updatedAt: '2026-08-19T10:00:00.000Z',
}

describe('UniversitiesPage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders stats, toolbar, and universities table', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          data: [sampleUniversity],
          pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1 },
        }),
      ),
    )

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(<UniversitiesPage />, { wrapper })

    expect(screen.getByText('Platform Administration')).toBeInTheDocument()
    expect(screen.getByText('Universities')).toBeInTheDocument()
    expect(screen.getByText('Total Universities')).toBeInTheDocument()
    expect(screen.getByText('Active Tenants')).toBeInTheDocument()
    expect(screen.getByText('Inactive Tenants')).toBeInTheDocument()
    expect(screen.getByText('Suspended Tenants')).toBeInTheDocument()
    expect(screen.queryByText('Tenancy Reach')).not.toBeInTheDocument()
    expect(screen.getByText('All Statuses')).toBeInTheDocument()
    expect(screen.getByText('Newest first')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(/search universities by name or code/i),
    ).toBeInTheDocument()

    await vi.waitFor(() => {
      expect(screen.getByText('King Saud University')).toBeInTheDocument()
      expect(screen.getByText('KSU')).toBeInTheDocument()
    })
  })
})
