import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
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
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders university details, 4 tabs, and general tab content', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(
      <UniversityDetailsDialog
        university={mockUniversity}
        open={true}
        onOpenChange={vi.fn()}
      />,
      { wrapper },
    )

    expect(
      screen.getByRole('heading', { name: 'King Saud University' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('KSU')[0]).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /general/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /manager/i })).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /plan & pricing/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument()

    // General tab metrics
    expect(screen.getByText('1250')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('navigates between tabs and renders corresponding information', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          universityId: mockUniversity.id,
          universityName: mockUniversity.name,
          universityCode: mockUniversity.code,
          universityStatus: 'ACTIVE',
          subscriptionStatus: 'ACTIVE',
          cancelAtPeriodEnd: false,
          canceledAt: null,
          currentStudentsCount: 1250,
          peakStudentsCount: 1300,
          customPricePerSeat: null,
          nextCustomPricePerSeat: null,
          defaultPricePerSeat: 10,
          effectivePricePerSeat: 10,
          nextEffectivePricePerSeat: null,
          hasNextPriceChange: false,
          nextPriceEffectiveDate: null,
          isCustomPrice: false,
          estimatedMonthlyTotal: 13000,
          currency: 'USD',
          billingPeriod: '2026-08',
          billingPeriodStart: '2026-08-01T00:00:00.000Z',
          billingPeriodEnd: '2026-08-31T23:59:59.999Z',
          nextBillingDate: '2026-09-01T00:00:00.000Z',
        }),
      ),
    )

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(
      <UniversityDetailsDialog
        university={mockUniversity}
        open={true}
        onOpenChange={vi.fn()}
      />,
      { wrapper },
    )

    // Switch to Manager tab
    await user.click(screen.getByRole('tab', { name: /manager/i }))
    expect(screen.getByText('Dr. Fatima Al-Otaibi')).toBeInTheDocument()
    expect(screen.getByText('admin@ksu.edu.sa')).toBeInTheDocument()

    // Switch to Plan & Pricing tab
    await user.click(screen.getByRole('tab', { name: /plan & pricing/i }))
    await screen.findByText('Institutional Subscription Plan')
    expect(screen.getByText('$10.00')).toBeInTheDocument()

    // Switch to History tab
    await user.click(screen.getByRole('tab', { name: /history/i }))
    expect(screen.getByText('University Provisioned')).toBeInTheDocument()
    expect(screen.getByText('Profile & Tenancy Updates')).toBeInTheDocument()
  })

  it('triggers action callbacks when edit button is clicked in General tab', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onChangeStatus = vi.fn()
    const onOpenChange = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(
      <UniversityDetailsDialog
        university={mockUniversity}
        open={true}
        onOpenChange={onOpenChange}
        onEdit={onEdit}
        onChangeStatus={onChangeStatus}
      />,
      { wrapper },
    )

    await user.click(screen.getByRole('button', { name: /edit information/i }))
    expect(onEdit).toHaveBeenCalledWith(mockUniversity)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
