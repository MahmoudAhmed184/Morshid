import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AdminSubscriptionsPage } from './admin-subscriptions-page'

describe('AdminSubscriptionsPage', () => {
  let queryClient: QueryClient

  const sampleMySubscription = {
    universityId: '00000000-0000-4000-8000-000000000001',
    universityName: 'King Saud University',
    universityCode: 'KSU',
    universityStatus: 'ACTIVE',
    subscriptionStatus: 'ACTIVE' as const,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    currentStudentsCount: 60,
    peakStudentsCount: 160, // Peak 160, current 60 (100 deleted)
    customPricePerSeat: null,
    defaultPricePerSeat: 10.0,
    effectivePricePerSeat: 10.0,
    isCustomPrice: false,
    estimatedMonthlyTotal: 1600.0, // 160 * $10 = $1600
    currency: 'USD',
    billingPeriod: '2026-08-20_2026-09-20',
    billingPeriodStart: '2026-08-20T00:00:00.000Z',
    billingPeriodEnd: '2026-09-20T00:00:00.000Z',
    nextBillingDate: '2026-09-20T00:00:00.000Z',
    gracePeriodEnd: '2026-09-27T00:00:00.000Z',
    isInGracePeriod: false,
    isOverdue: false,
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
        if (url.includes('/api/v1/subscriptions/my-subscription/cancel')) {
          return Response.json({
            subscription: {
              ...sampleMySubscription,
              subscriptionStatus: 'PENDING_CANCELLATION',
              cancelAtPeriodEnd: true,
              canceledAt: '2026-08-25T10:00:00.000Z',
            },
          })
        }
        if (url.includes('/api/v1/subscriptions/my-subscription/resume')) {
          return Response.json({
            subscription: {
              ...sampleMySubscription,
              subscriptionStatus: 'ACTIVE',
              cancelAtPeriodEnd: false,
              canceledAt: null,
            },
          })
        }
        if (url.includes('/api/v1/subscriptions/my-subscription')) {
          return Response.json({ subscription: sampleMySubscription })
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

  it('renders university subscription details with anniversary peak student metrics', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AdminSubscriptionsPage />
      </QueryClientProvider>,
    )

    expect(screen.getByText('Subscription & Billing')).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByText(
          /Manage the institutional plan and seat capacity for King Saud University/i,
        ),
      ).toBeInTheDocument()
    })

    // Check peak students count and current students count
    expect(screen.getByText('160')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
    // Check estimated invoice
    expect(screen.getByText('1600.00')).toBeInTheDocument()
    // Check anniversary peak billing banner is displayed
    expect(
      screen.getByText(
        /Anniversary Monthly Peak \(High-Water Mark\) Billing Model/i,
      ),
    ).toBeInTheDocument()
  })

  it('opens cancel subscription dialog and triggers cancel', async () => {
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <AdminSubscriptionsPage />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cancel Subscription'))

    await waitFor(() => {
      expect(screen.getByText('Cancel Subscription?')).toBeInTheDocument()
      expect(
        screen.getByText(/Cancellation takes effect at period end/i),
      ).toBeInTheDocument()
    })

    await user.click(screen.getByText('Confirm Cancellation'))

    await waitFor(() => {
      expect(screen.queryByText('Cancel Subscription?')).not.toBeInTheDocument()
    })
  })

  it('displays pending cancellation banner and allows resuming', async () => {
    const user = userEvent.setup()

    const pendingSubscription = {
      ...sampleMySubscription,
      subscriptionStatus: 'PENDING_CANCELLATION' as const,
      cancelAtPeriodEnd: true,
      canceledAt: '2026-08-25T10:00:00.000Z',
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/v1/subscriptions/my-subscription/resume')) {
          return Response.json({
            subscription: {
              ...sampleMySubscription,
              subscriptionStatus: 'ACTIVE',
              cancelAtPeriodEnd: false,
              canceledAt: null,
            },
          })
        }
        return Response.json({ subscription: pendingSubscription })
      }),
    )

    render(
      <QueryClientProvider client={queryClient}>
        <AdminSubscriptionsPage />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(
        screen.getByText('Subscription scheduled for cancellation'),
      ).toBeInTheDocument()
    })

    const resumeButtons = screen.getAllByText('Resume Subscription')
    expect(resumeButtons.length).toBeGreaterThan(0)
    await user.click(resumeButtons[0])
  })

  it('displays 7-day payment grace period banner when invoice is due', async () => {
    const graceSubscription = {
      ...sampleMySubscription,
      isInGracePeriod: true,
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return Response.json({ subscription: graceSubscription })
      }),
    )

    render(
      <QueryClientProvider client={queryClient}>
        <AdminSubscriptionsPage />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(
        screen.getByText(/Invoice Payment Due – 7-Day Grace Period Active/i),
      ).toBeInTheDocument()
    })
  })

  it('displays suspension warning when university is suspended due to overdue invoice', async () => {
    const suspendedSubscription = {
      ...sampleMySubscription,
      universityStatus: 'SUSPENDED',
      isOverdue: true,
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return Response.json({ subscription: suspendedSubscription })
      }),
    )

    render(
      <QueryClientProvider client={queryClient}>
        <AdminSubscriptionsPage />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(
        screen.getByText(/University Access Suspended/i),
      ).toBeInTheDocument()
    })
  })
})
