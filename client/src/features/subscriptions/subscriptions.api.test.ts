import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  cancelMySubscription,
  getGlobalPricing,
  getMySubscription,
  listUniversityInvoices,
  listSubscriptions,
  resumeMySubscription,
  updateGlobalPricing,
  updateUniversitySubscription,
} from './subscriptions.api'

describe('subscriptions.api', () => {
  const sampleItem = {
    universityId: '00000000-0000-4000-8000-000000000001',
    universityName: 'King Saud University',
    universityCode: 'KSU',
    universityStatus: 'ACTIVE',
    subscriptionStatus: 'ACTIVE' as const,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    currentStudentsCount: 120,
    peakStudentsCount: 200,
    customPricePerSeat: null,
    defaultPricePerSeat: 10.0,
    effectivePricePerSeat: 10.0,
    isCustomPrice: false,
    estimatedMonthlyTotal: 2000.0,
    currency: 'USD',
    billingPeriod: '2026-08-20_2026-09-20',
    billingPeriodStart: '2026-08-20T00:00:00.000Z',
    billingPeriodEnd: '2026-09-20T00:00:00.000Z',
    nextBillingDate: '2026-09-20T00:00:00.000Z',
    gracePeriodEnd: '2026-09-27T00:00:00.000Z',
    isInGracePeriod: false,
    isOverdue: false,
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches global pricing', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        defaultPricePerSeat: 10.0,
        currency: 'USD',
        updatedAt: '2026-08-01T00:00:00.000Z',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await getGlobalPricing()
    expect(result.defaultPricePerSeat).toBe(10.0)
    expect(result.currency).toBe('USD')
  })

  it('updates global pricing', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body))
        expect(body.defaultPricePerSeat).toBe(14.0)
        return Response.json({
          defaultPricePerSeat: 14.0,
          currency: 'USD',
          updatedAt: '2026-08-02T00:00:00.000Z',
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateGlobalPricing({
      defaultPricePerSeat: 14.0,
      currency: 'USD',
    })
    expect(result.defaultPricePerSeat).toBe(14.0)
  })

  it('lists university subscriptions with query params', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      expect(url).toContain('/api/v1/subscriptions?')
      expect(url).toContain('search=ksu')
      expect(url).toContain('page=1')
      expect(url).toContain('limit=20')
      return Response.json({
        data: [sampleItem],
        pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1 },
        summary: {
          totalSubscribedUniversities: 1,
          totalActiveStudents: 120,
          totalPeakStudents: 200,
          totalEstimatedRevenue: 2000.0,
          defaultPricePerSeat: 10.0,
          currency: 'USD',
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await listSubscriptions({ search: 'ksu' })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].peakStudentsCount).toBe(200)
    expect(result.summary.totalEstimatedRevenue).toBe(2000.0)
  })

  it('updates custom seat price for a university', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toContain(sampleItem.universityId)
        const body = JSON.parse(String(init?.body))
        expect(body.customPricePerSeat).toBe(8.0)
        return Response.json({
          ...sampleItem,
          customPricePerSeat: 8.0,
          effectivePricePerSeat: 8.0,
          isCustomPrice: true,
          estimatedMonthlyTotal: 1600.0,
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateUniversitySubscription(sampleItem.universityId, {
      customPricePerSeat: 8.0,
    })
    expect(result.customPricePerSeat).toBe(8.0)
    expect(result.effectivePricePerSeat).toBe(8.0)
    expect(result.estimatedMonthlyTotal).toBe(1600.0)
  })

  it('lists filtered university invoices with pagination', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      expect(url).toContain('/invoices?')
      expect(url).toContain('from=2025-07-01')
      expect(url).toContain('to=2026-08-31')
      expect(url).toContain('sortBy=amount')
      return Response.json({
        data: [],
        pagination: { page: 1, limit: 10, totalCount: 0, totalPages: 0 },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await listUniversityInvoices(sampleItem.universityId, {
      from: '2025-07-01',
      to: '2026-08-31',
      sortBy: 'amount',
      sortOrder: 'desc',
    })

    expect(result.pagination.totalCount).toBe(0)
  })

  it('fetches manager my-subscription', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ subscription: sampleItem }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await getMySubscription()
    expect(result.universityCode).toBe('KSU')
    expect(result.peakStudentsCount).toBe(200)
  })

  it('cancels my subscription scheduled for period end', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        subscription: {
          ...sampleItem,
          subscriptionStatus: 'PENDING_CANCELLATION',
          cancelAtPeriodEnd: true,
          canceledAt: '2026-08-19T12:00:00.000Z',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await cancelMySubscription()
    expect(result.subscriptionStatus).toBe('PENDING_CANCELLATION')
    expect(result.cancelAtPeriodEnd).toBe(true)
  })

  it('resumes my subscription', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        subscription: {
          ...sampleItem,
          subscriptionStatus: 'ACTIVE',
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await resumeMySubscription()
    expect(result.subscriptionStatus).toBe('ACTIVE')
    expect(result.cancelAtPeriodEnd).toBe(false)
  })
})
