import { NotFoundException } from '@nestjs/common'

import {
  SubscriptionStatus,
  type ListSubscriptionsQuery,
  type UpdateGlobalPricingRequest,
  type UpdateUniversitySubscriptionRequest,
} from './subscriptions.types'
import {
  SubscriptionsRepository,
  type GlobalPricingRecord,
  type SubscriptionsPageRecord,
  type UniversitySubscriptionDetailsRecord,
} from './subscriptions.repository'
import { SubscriptionsService } from './subscriptions.service'
import { UniversityNotFoundError } from './subscriptions.errors'

class InMemorySubscriptionsRepository extends SubscriptionsRepository {
  globalPricing: GlobalPricingRecord = {
    defaultPricePerSeat: 10.0,
    nextPricePerSeat: null,
    nextPriceEffectiveAt: null,
    currency: 'USD',
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  }

  subscriptions = new Map<string, UniversitySubscriptionDetailsRecord>()

  getGlobalPricing(): Promise<GlobalPricingRecord> {
    return Promise.resolve(this.globalPricing)
  }

  updateGlobalPricing(
    input: UpdateGlobalPricingRequest,
  ): Promise<GlobalPricingRecord> {
    this.globalPricing = {
      defaultPricePerSeat: this.globalPricing.defaultPricePerSeat,
      nextPricePerSeat: input.defaultPricePerSeat,
      nextPriceEffectiveAt: new Date('2026-09-01T00:00:00.000Z'),
      currency: input.currency,
      updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    }
    return Promise.resolve(this.globalPricing)
  }

  listSubscriptions(
    query: ListSubscriptionsQuery,
  ): Promise<SubscriptionsPageRecord> {
    const list = Array.from(this.subscriptions.values())
    const totalCount = list.length
    const totalPages = Math.ceil(totalCount / query.limit)
    const data = list.slice(
      (query.page - 1) * query.limit,
      query.page * query.limit,
    )

    const totalActiveStudents = list.reduce(
      (sum, r) => sum + r.currentStudentsCount,
      0,
    )
    const totalPeakStudents = list.reduce(
      (sum, r) => sum + r.peakStudentsCount,
      0,
    )
    const totalEstimatedRevenue = list.reduce(
      (sum, r) =>
        r.subscriptionStatus !== SubscriptionStatus.CANCELLED
          ? sum + r.estimatedMonthlyTotal
          : sum,
      0,
    )

    return Promise.resolve({
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages,
      },
      summary: {
        totalSubscribedUniversities: list.length,
        totalActiveStudents,
        totalPeakStudents,
        totalEstimatedRevenue,
        defaultPricePerSeat: this.globalPricing.defaultPricePerSeat,
        currency: this.globalPricing.currency,
      },
    })
  }

  getUniversitySubscription(
    universityId: string,
  ): Promise<UniversitySubscriptionDetailsRecord> {
    const existing = this.subscriptions.get(universityId)
    if (existing === undefined) {
      return Promise.reject(new UniversityNotFoundError(universityId))
    }
    return Promise.resolve(existing)
  }

  updateUniversitySubscription(
    universityId: string,
    input: UpdateUniversitySubscriptionRequest,
  ): Promise<UniversitySubscriptionDetailsRecord> {
    const existing = this.subscriptions.get(universityId)
    if (existing === undefined) {
      return Promise.reject(new UniversityNotFoundError(universityId))
    }

    const nextCustomPrice =
      input.customPricePerSeat !== undefined
        ? input.customPricePerSeat
        : existing.nextCustomPricePerSeat

    const effectivePrice =
      existing.customPricePerSeat ?? this.globalPricing.defaultPricePerSeat

    const status =
      input.status ??
      (input.cancelAtPeriodEnd === true
        ? SubscriptionStatus.PENDING_CANCELLATION
        : existing.subscriptionStatus)

    const updated: UniversitySubscriptionDetailsRecord = {
      ...existing,
      customPricePerSeat: existing.customPricePerSeat,
      nextCustomPricePerSeat: nextCustomPrice,
      effectivePricePerSeat: effectivePrice,
      nextEffectivePricePerSeat: nextCustomPrice,
      hasNextPriceChange: nextCustomPrice !== null,
      nextPriceEffectiveDate:
        nextCustomPrice !== null ? new Date('2026-09-20T00:00:00.000Z') : null,
      isCustomPrice: existing.customPricePerSeat !== null,
      subscriptionStatus: status,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? existing.cancelAtPeriodEnd,
      canceledAt:
        input.cancelAtPeriodEnd === true
          ? new Date('2026-08-25T00:00:00.000Z')
          : null,
      estimatedMonthlyTotal: existing.peakStudentsCount * effectivePrice,
    }

    this.subscriptions.set(universityId, updated)
    return Promise.resolve(updated)
  }

  cancelUniversitySubscription(
    universityId: string,
  ): Promise<UniversitySubscriptionDetailsRecord> {
    return this.updateUniversitySubscription(universityId, {
      cancelAtPeriodEnd: true,
      status: SubscriptionStatus.PENDING_CANCELLATION,
    })
  }

  resumeUniversitySubscription(
    universityId: string,
  ): Promise<UniversitySubscriptionDetailsRecord> {
    return this.updateUniversitySubscription(universityId, {
      cancelAtPeriodEnd: false,
      status: SubscriptionStatus.ACTIVE,
    })
  }
}

describe('SubscriptionsService', () => {
  let repository: InMemorySubscriptionsRepository
  let service: SubscriptionsService

  const sampleUniversityId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

  beforeEach(() => {
    repository = new InMemorySubscriptionsRepository()
    service = new SubscriptionsService(repository)

    // Seed sample university subscription with anniversary cycle (Aug 20 -> Sep 20)
    repository.subscriptions.set(sampleUniversityId, {
      universityId: sampleUniversityId,
      universityName: 'Test University',
      universityCode: 'TEST-UNI',
      universityStatus: 'ACTIVE',
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      currentStudentsCount: 50,
      peakStudentsCount: 150, // High water mark was 150 even though current is 50
      customPricePerSeat: null,
      nextCustomPricePerSeat: null,
      defaultPricePerSeat: 10.0,
      effectivePricePerSeat: 10.0,
      nextEffectivePricePerSeat: null,
      hasNextPriceChange: false,
      nextPriceEffectiveDate: null,
      isCustomPrice: false,
      estimatedMonthlyTotal: 1500.0, // 150 * $10 = $1500
      currency: 'USD',
      billingPeriod: '2026-08-20_2026-09-20',
      billingPeriodStart: new Date('2026-08-20T00:00:00.000Z'),
      billingPeriodEnd: new Date('2026-09-20T00:00:00.000Z'),
      nextBillingDate: new Date('2026-09-20T00:00:00.000Z'),
      gracePeriodEnd: new Date('2026-09-27T00:00:00.000Z'),
      isInGracePeriod: false,
      isOverdue: false,
    })
  })

  describe('global pricing', () => {
    it('returns global pricing configuration', async () => {
      const result = await service.getGlobalPricing()
      expect(result.defaultPricePerSeat).toBe(10.0)
      expect(result.currency).toBe('USD')
    })

    it('updates global pricing configuration scheduled for next month', async () => {
      const result = await service.updateGlobalPricing({
        defaultPricePerSeat: 12.5,
        currency: 'USD',
      })
      expect(result.defaultPricePerSeat).toBe(10.0)
      expect(result.nextPricePerSeat).toBe(12.5)
      expect(result.currency).toBe('USD')
    })
  })

  describe('university subscriptions list & details with anniversary billing', () => {
    it('lists university subscriptions with peak metrics, anniversary dates, and summary', async () => {
      const result = await service.listSubscriptions({
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc',
      })

      expect(result.data).toHaveLength(1)
      expect(result.data[0].universityName).toBe('Test University')
      expect(result.data[0].currentStudentsCount).toBe(50)
      expect(result.data[0].peakStudentsCount).toBe(150)
      expect(result.data[0].effectivePricePerSeat).toBe(10.0)
      expect(result.data[0].estimatedMonthlyTotal).toBe(1500.0)
      expect(result.data[0].billingPeriod).toBe('2026-08-20_2026-09-20')
      expect(result.data[0].billingPeriodStart).toBe('2026-08-20T00:00:00.000Z')
      expect(result.data[0].billingPeriodEnd).toBe('2026-09-20T00:00:00.000Z')
      expect(result.data[0].nextBillingDate).toBe('2026-09-20T00:00:00.000Z')
      expect(result.data[0].gracePeriodEnd).toBe('2026-09-27T00:00:00.000Z')
      expect(result.data[0].isInGracePeriod).toBe(false)
      expect(result.data[0].isOverdue).toBe(false)
      expect(result.summary.totalPeakStudents).toBe(150)
      expect(result.summary.totalEstimatedRevenue).toBe(1500.0)
    })

    it('retrieves single university subscription with peak pricing', async () => {
      const result = await service.getUniversitySubscription(sampleUniversityId)

      expect(result.universityId).toBe(sampleUniversityId)
      expect(result.peakStudentsCount).toBe(150)
      expect(result.estimatedMonthlyTotal).toBe(1500.0)
      expect(result.billingPeriod).toBe('2026-08-20_2026-09-20')
    })

    it('throws NotFoundException when university does not exist', async () => {
      await expect(
        service.getUniversitySubscription('non-existent-id'),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('custom pricing override', () => {
    it('schedules custom seat price for next cycle', async () => {
      const result = await service.updateUniversitySubscription(
        sampleUniversityId,
        {
          customPricePerSeat: 7.5,
        },
      )

      expect(result.nextCustomPricePerSeat).toBe(7.5)
      expect(result.effectivePricePerSeat).toBe(10.0)
      expect(result.hasNextPriceChange).toBe(true)
      expect(result.estimatedMonthlyTotal).toBe(1500.0)
    })

    it('resets custom seat price back to global default pricing', async () => {
      const result = await service.updateUniversitySubscription(
        sampleUniversityId,
        {
          customPricePerSeat: null,
        },
      )

      expect(result.nextCustomPricePerSeat).toBeNull()
      expect(result.effectivePricePerSeat).toBe(10.0)
      expect(result.hasNextPriceChange).toBe(false)
      expect(result.estimatedMonthlyTotal).toBe(1500.0)
    })
  })

  describe('cancellation and resumption workflow', () => {
    it('schedules cancellation at end of anniversary period', async () => {
      const response = await service.cancelMySubscription(sampleUniversityId)

      expect(response.subscription.subscriptionStatus).toBe(
        SubscriptionStatus.PENDING_CANCELLATION,
      )
      expect(response.subscription.cancelAtPeriodEnd).toBe(true)
      expect(response.subscription.canceledAt).not.toBeNull()
      expect(response.subscription.estimatedMonthlyTotal).toBe(1500.0)
    })

    it('resumes a pending cancellation before anniversary period ends', async () => {
      await service.cancelMySubscription(sampleUniversityId)

      const response = await service.resumeMySubscription(sampleUniversityId)

      expect(response.subscription.subscriptionStatus).toBe(
        SubscriptionStatus.ACTIVE,
      )
      expect(response.subscription.cancelAtPeriodEnd).toBe(false)
      expect(response.subscription.canceledAt).toBeNull()
    })

    it('throws NotFoundException when universityId is undefined for manager', async () => {
      await expect(service.getMySubscription(undefined)).rejects.toThrow(
        NotFoundException,
      )
      await expect(service.cancelMySubscription(undefined)).rejects.toThrow(
        NotFoundException,
      )
      await expect(service.resumeMySubscription(undefined)).rejects.toThrow(
        NotFoundException,
      )
    })
  })
})
