import { describe, expect, it } from 'vitest'

import {
  globalPricingSchema,
  mySubscriptionResponseSchema,
  subscriptionListResponseSchema,
  subscriptionStatusSchema,
  universitySubscriptionItemSchema,
  updateCustomPriceFormSchema,
  updateGlobalPricingFormSchema,
} from './subscriptions.schema'

describe('subscriptions.schema', () => {
  const sampleSubscriptionItem = {
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

  it('parses valid subscription status', () => {
    expect(subscriptionStatusSchema.parse('ACTIVE')).toBe('ACTIVE')
    expect(subscriptionStatusSchema.parse('PENDING_CANCELLATION')).toBe(
      'PENDING_CANCELLATION',
    )
    expect(subscriptionStatusSchema.parse('CANCELLED')).toBe('CANCELLED')
    expect(() => subscriptionStatusSchema.parse('EXPIRED')).toThrow()
  })

  it('parses valid global pricing object', () => {
    const globalPricing = {
      defaultPricePerSeat: 10.0,
      nextPricePerSeat: 12.0,
      nextPriceEffectiveAt: '2026-09-01T00:00:00.000Z',
      currency: 'USD',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    const result = globalPricingSchema.safeParse(globalPricing)
    expect(result.success).toBe(true)
  })

  it('validates updateGlobalPricingFormSchema', () => {
    const valid = { defaultPricePerSeat: 15.5, currency: 'USD' }
    expect(updateGlobalPricingFormSchema.safeParse(valid).success).toBe(true)

    const validNoCurrency = { defaultPricePerSeat: 15.5 }
    expect(
      updateGlobalPricingFormSchema.safeParse(validNoCurrency).success,
    ).toBe(true)

    const negative = { defaultPricePerSeat: -5, currency: 'USD' }
    expect(updateGlobalPricingFormSchema.safeParse(negative).success).toBe(
      false,
    )
  })

  it('validates updateCustomPriceFormSchema', () => {
    expect(
      updateCustomPriceFormSchema.safeParse({ customPricePerSeat: 8.5 })
        .success,
    ).toBe(true)
    expect(
      updateCustomPriceFormSchema.safeParse({ customPricePerSeat: null })
        .success,
    ).toBe(true)
    expect(
      updateCustomPriceFormSchema.safeParse({ customPricePerSeat: -1 }).success,
    ).toBe(false)
  })

  it('parses university subscription item', () => {
    const result = universitySubscriptionItemSchema.safeParse(
      sampleSubscriptionItem,
    )
    expect(result.success).toBe(true)

    const withScheduled = {
      ...sampleSubscriptionItem,
      nextCustomPricePerSeat: 15.0,
      nextEffectivePricePerSeat: 15.0,
      hasNextPriceChange: true,
      nextPriceEffectiveDate: '2026-09-01T00:00:00.000Z',
    }
    const resultScheduled =
      universitySubscriptionItemSchema.safeParse(withScheduled)
    expect(resultScheduled.success).toBe(true)
  })

  it('parses subscription list response with summary and pagination', () => {
    const response = {
      data: [sampleSubscriptionItem],
      pagination: {
        page: 1,
        limit: 20,
        totalCount: 1,
        totalPages: 1,
      },
      summary: {
        totalSubscribedUniversities: 1,
        totalActiveStudents: 120,
        totalPeakStudents: 200,
        totalEstimatedRevenue: 2000.0,
        defaultPricePerSeat: 10.0,
        currency: 'USD',
      },
    }

    const result = subscriptionListResponseSchema.safeParse(response)
    expect(result.success).toBe(true)
  })

  it('parses my subscription response', () => {
    const response = { subscription: sampleSubscriptionItem }
    const result = mySubscriptionResponseSchema.safeParse(response)
    expect(result.success).toBe(true)
  })
})
