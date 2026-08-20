import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as universitiesApi from '@/features/universities/universities.api'
import { SuperAdminOverviewPage } from './super-admin-overview-page'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
    params,
  }: {
    children: React.ReactNode
    to: string
    className?: string
    params?: Record<string, string>
  }) => {
    let href = to
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`$${key}`, value)
      }
    }
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  },
}))

const sampleUniversities = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'King Saud University',
    code: 'KSU',
    status: 'ACTIVE' as const,
    owner: {
      id: '00000000-0000-4000-8000-000000000002',
      displayName: 'Dr. Fatima',
      email: 'fatima@ksu.edu.sa',
      status: 'ACTIVE' as const,
    },
    studentsCount: 1200,
    instructorsCount: 80,
    coursesCount: 45,
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z',
  },
]

describe('SuperAdminOverviewPage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders global metric cards and recent universities', async () => {
    vi.spyOn(universitiesApi, 'listUniversities').mockResolvedValue({
      data: sampleUniversities,
      pagination: {
        page: 1,
        limit: 10,
        totalCount: 1,
        totalPages: 1,
      },
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(<SuperAdminOverviewPage />, { wrapper })

    expect(screen.getByText('Super Admin Overview')).toBeInTheDocument()
    expect(screen.getByText('Total Universities')).toBeInTheDocument()
    expect(screen.getByText('Active Tenants')).toBeInTheDocument()
    expect(screen.getByText('Inactive Tenants')).toBeInTheDocument()
    expect(screen.getByText('Suspended Tenants')).toBeInTheDocument()
    expect(
      screen.queryByText('Enrolled student learners across active tenants'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Active teaching staff across active tenants'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Total learning course shells configured'),
    ).not.toBeInTheDocument()
    expect(await screen.findByText('King Saud University')).toBeInTheDocument()
    expect(screen.getByText('Manage Universities')).toBeInTheDocument()
    expect(screen.getByText('Super Admin Settings')).toBeInTheDocument()
  })
})
