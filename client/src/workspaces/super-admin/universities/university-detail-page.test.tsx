import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UniversityItem } from '@/features/universities/universities.schema'
import { UniversityDetailPage } from './university-detail-page'

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

describe('UniversityDetailPage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders university profile and 4 tabs with clean institution info', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        const urlStr = String(input)
        if (urlStr.includes('/invoices')) {
          return Response.json({
            data: [],
            pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 0 },
          })
        }
        if (urlStr.includes('/api/v1/universities/')) {
          return Response.json({ university: mockUniversity })
        }
        return Response.json({
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
        })
      }),
    )

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(<UniversityDetailPage universityId={mockUniversity.id} />, {
      wrapper,
    })

    await screen.findByRole('heading', { name: 'King Saud University' })
    expect(screen.getAllByText('KSU')[0]).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /general/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /manager/i })).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /plan & pricing/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /invoices/i })).toBeInTheDocument()

    // General tab institution details
    expect(
      screen.getByText('Institution Profile & Identification'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /edit information/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Enrolled Students')).not.toBeInTheDocument()
  })

  it('switches between tabs and allows triggering pricing update', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        const urlStr = String(input)
        if (urlStr.includes('/invoices')) {
          return Response.json({
            data: [],
            pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 0 },
          })
        }
        if (urlStr.includes('/api/v1/universities/')) {
          return Response.json({ university: mockUniversity })
        }
        return Response.json({
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
        })
      }),
    )

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(<UniversityDetailPage universityId={mockUniversity.id} />, {
      wrapper,
    })

    await screen.findByRole('heading', { name: 'King Saud University' })

    // Switch to Manager tab
    await user.click(screen.getByRole('tab', { name: /manager/i }))
    expect(screen.getByText('Dr. Fatima Al-Otaibi')).toBeInTheDocument()
    expect(screen.getByText('admin@ksu.edu.sa')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /edit manager info/i }),
    ).toBeInTheDocument()

    // Switch to Plan & Pricing tab
    await user.click(screen.getByRole('tab', { name: /plan & pricing/i }))
    await screen.findByText('Active Plan Tier')
    expect(screen.getByText('$10.00')).toBeInTheDocument()
    expect(screen.getByText('$13,000.00')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /update pricing/i }),
    ).toBeInTheDocument()

    // Switch to invoice history
    await user.click(screen.getByRole('tab', { name: /invoices/i }))
    expect(screen.getByText('Invoice History')).toBeInTheDocument()
    expect(screen.getByText('No finalized invoices yet')).toBeInTheDocument()
  })

  it('triggers ConfirmDialog when choosing a new status from status dropdown', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        const urlStr = String(input)
        if (urlStr.includes('/invoices')) {
          return Response.json({
            data: [],
            pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 0 },
          })
        }
        if (urlStr.includes('/api/v1/universities/')) {
          return Response.json({ university: mockUniversity })
        }
        return Response.json({
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
        })
      }),
    )

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    render(<UniversityDetailPage universityId={mockUniversity.id} />, {
      wrapper,
    })

    await screen.findByRole('heading', { name: 'King Saud University' })

    // Open Status dropdown
    const statusBtn = screen.getByRole('button', { name: /status: active/i })
    await user.click(statusBtn)

    // Click Suspended option
    const suspendedItem = await screen.findByText('Suspended')
    await user.click(suspendedItem)

    // Verify ConfirmDialog opens
    expect(
      screen.getByText(/change status to suspended\?/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /are you sure you want to suspend "king saud university"\?/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /set to suspended/i }),
    ).toBeInTheDocument()
  })
})
