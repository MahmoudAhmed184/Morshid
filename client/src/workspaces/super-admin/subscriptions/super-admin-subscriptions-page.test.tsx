import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SuperAdminSubscriptionsPage } from './super-admin-subscriptions-page'

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

describe('SuperAdminSubscriptionsPage', () => {
  let queryClient: QueryClient

  const sampleGlobalPricing = {
    defaultPricePerSeat: 10.0,
    currency: 'USD',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }

  const sampleSubscriptionsList = {
    data: [
      {
        universityId: '00000000-0000-4000-8000-000000000001',
        universityName: 'King Saud University',
        universityCode: 'KSU',
        universityStatus: 'ACTIVE',
        subscriptionStatus: 'ACTIVE' as const,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        currentStudentsCount: 50,
        peakStudentsCount: 150, // Peak 150
        customPricePerSeat: null,
        defaultPricePerSeat: 10.0,
        effectivePricePerSeat: 10.0,
        isCustomPrice: false,
        estimatedMonthlyTotal: 1500.0,
        currency: 'USD',
        billingPeriod: '2026-08',
        billingPeriodStart: '2026-08-01T00:00:00.000Z',
        billingPeriodEnd: '2026-08-31T23:59:59.999Z',
        nextBillingDate: '2026-09-01T00:00:00.000Z',
      },
      {
        universityId: '00000000-0000-4000-8000-000000000002',
        universityName: 'Cairo University',
        universityCode: 'CU',
        universityStatus: 'ACTIVE',
        subscriptionStatus: 'ACTIVE' as const,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        currentStudentsCount: 80,
        peakStudentsCount: 100,
        customPricePerSeat: 7.5,
        defaultPricePerSeat: 10.0,
        effectivePricePerSeat: 7.5,
        isCustomPrice: true,
        estimatedMonthlyTotal: 750.0,
        currency: 'USD',
        billingPeriod: '2026-08',
        billingPeriodStart: '2026-08-01T00:00:00.000Z',
        billingPeriodEnd: '2026-08-31T23:59:59.999Z',
        nextBillingDate: '2026-09-01T00:00:00.000Z',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      totalCount: 2,
      totalPages: 1,
    },
    summary: {
      totalSubscribedUniversities: 2,
      totalActiveStudents: 130,
      totalPeakStudents: 250,
      totalEstimatedRevenue: 2250.0,
      defaultPricePerSeat: 10.0,
      currency: 'USD',
    },
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/v1/subscriptions/global-pricing')) {
          return Response.json(sampleGlobalPricing)
        }
        if (url.includes('/api/v1/subscriptions')) {
          return Response.json(sampleSubscriptionsList)
        }
        return Response.json({})
      }),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders subscriptions dashboard with pricing card and table', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SuperAdminSubscriptionsPage />
      </QueryClientProvider>,
    )

    expect(screen.getByText('Subscriptions & Pricing')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('King Saud University')).toBeInTheDocument()
      expect(screen.getByText('Cairo University')).toBeInTheDocument()
    })

    // Check peak billing display
    expect(screen.getByText('Peak: 150')).toBeInTheDocument()
    expect(screen.getByText('1500.00')).toBeInTheDocument()

    // Check custom badge on Cairo University
    expect(screen.getByText('Custom')).toBeInTheDocument()
    expect(screen.getByText('750.00')).toBeInTheDocument()
  })

  it('renders global pricing standard card', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SuperAdminSubscriptionsPage />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Global Pricing Standard')).toBeInTheDocument()
      expect(
        screen.getByLabelText(/Set new price for next month/i),
      ).toBeInTheDocument()
    })
  })

  it('opens custom pricing dialog for a university', async () => {
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <SuperAdminSubscriptionsPage />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(
        screen.getByLabelText(/Configure pricing for King Saud University/i),
      ).toBeInTheDocument()
    })

    const configButton = screen.getByLabelText(
      /Configure pricing for King Saud University/i,
    )
    await user.click(configButton)

    await waitFor(() => {
      expect(
        screen.getByText('Configure University Subscription'),
      ).toBeInTheDocument()
    })
  })
})
