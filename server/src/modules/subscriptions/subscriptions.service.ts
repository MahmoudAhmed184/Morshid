import { Injectable, NotFoundException } from '@nestjs/common'

import {
  SubscriptionNotFoundError,
  UniversityNotFoundError,
  subscriptionNotFoundException,
  universityNotFoundException,
} from './subscriptions.errors'
import {
  SubscriptionsRepository,
  type GlobalPricingRecord,
  type SubscriptionInvoiceRecord,
  type UniversitySubscriptionDetailsRecord,
} from './subscriptions.repository'
import type {
  GlobalPricingDto,
  ListSubscriptionsQuery,
  ListUniversityInvoicesQuery,
  MySubscriptionResponseDto,
  SubscriptionInvoiceDto,
  SubscriptionInvoiceListResponseDto,
  SubscriptionListResponseDto,
  UniversitySubscriptionItemDto,
  UpdateGlobalPricingRequest,
  UpdateUniversitySubscriptionRequest,
} from './subscriptions.types'

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly subscriptionsRepository: SubscriptionsRepository,
  ) {}

  async getGlobalPricing(): Promise<GlobalPricingDto> {
    const record = await this.subscriptionsRepository.getGlobalPricing()
    return mapGlobalPricingRecord(record)
  }

  async markInvoicePaid(invoiceId: string): Promise<void> {
    const updated =
      await this.subscriptionsRepository.markInvoicePaid(invoiceId)
    if (!updated) {
      throw new NotFoundException({
        code: 'SUBSCRIPTION_INVOICE_NOT_FOUND',
        message: `Subscription invoice ${invoiceId} was not found`,
      })
    }
  }

  async listUniversityInvoices(
    universityId: string,
    query: ListUniversityInvoicesQuery,
  ): Promise<SubscriptionInvoiceListResponseDto> {
    try {
      const page = await this.subscriptionsRepository.listUniversityInvoices(
        universityId,
        query,
      )
      return {
        data: page.data.map(mapSubscriptionInvoiceRecord),
        pagination: page.pagination,
      }
    } catch (error) {
      if (error instanceof UniversityNotFoundError) {
        throw universityNotFoundException(universityId)
      }
      throw error
    }
  }

  async updateGlobalPricing(
    input: UpdateGlobalPricingRequest,
  ): Promise<GlobalPricingDto> {
    const record = await this.subscriptionsRepository.updateGlobalPricing(input)
    return mapGlobalPricingRecord(record)
  }

  async listSubscriptions(
    query: ListSubscriptionsQuery,
  ): Promise<SubscriptionListResponseDto> {
    const page = await this.subscriptionsRepository.listSubscriptions(query)

    return {
      data: page.data.map(mapUniversitySubscriptionRecord),
      pagination: page.pagination,
      summary: page.summary,
    }
  }

  async getUniversitySubscription(
    universityId: string,
  ): Promise<UniversitySubscriptionItemDto> {
    try {
      const record =
        await this.subscriptionsRepository.getUniversitySubscription(
          universityId,
        )
      return mapUniversitySubscriptionRecord(record)
    } catch (error) {
      if (error instanceof UniversityNotFoundError) {
        throw universityNotFoundException(universityId)
      }
      if (error instanceof SubscriptionNotFoundError) {
        throw subscriptionNotFoundException(universityId)
      }
      throw error
    }
  }

  async updateUniversitySubscription(
    universityId: string,
    input: UpdateUniversitySubscriptionRequest,
  ): Promise<UniversitySubscriptionItemDto> {
    try {
      const record =
        await this.subscriptionsRepository.updateUniversitySubscription(
          universityId,
          input,
        )
      return mapUniversitySubscriptionRecord(record)
    } catch (error) {
      if (error instanceof UniversityNotFoundError) {
        throw universityNotFoundException(universityId)
      }
      throw error
    }
  }

  async getMySubscription(
    universityId: string | null | undefined,
  ): Promise<MySubscriptionResponseDto> {
    if (
      universityId === null ||
      universityId === undefined ||
      universityId === ''
    ) {
      throw universityNotFoundException('unknown')
    }

    const subscription = await this.getUniversitySubscription(universityId)
    return { subscription }
  }

  async cancelMySubscription(
    universityId: string | null | undefined,
  ): Promise<MySubscriptionResponseDto> {
    if (
      universityId === null ||
      universityId === undefined ||
      universityId === ''
    ) {
      throw universityNotFoundException('unknown')
    }

    try {
      const record =
        await this.subscriptionsRepository.cancelUniversitySubscription(
          universityId,
        )
      return { subscription: mapUniversitySubscriptionRecord(record) }
    } catch (error) {
      if (error instanceof UniversityNotFoundError) {
        throw universityNotFoundException(universityId)
      }
      throw error
    }
  }

  async resumeMySubscription(
    universityId: string | null | undefined,
  ): Promise<MySubscriptionResponseDto> {
    if (
      universityId === null ||
      universityId === undefined ||
      universityId === ''
    ) {
      throw universityNotFoundException('unknown')
    }

    try {
      const record =
        await this.subscriptionsRepository.resumeUniversitySubscription(
          universityId,
        )
      return { subscription: mapUniversitySubscriptionRecord(record) }
    } catch (error) {
      if (error instanceof UniversityNotFoundError) {
        throw universityNotFoundException(universityId)
      }
      throw error
    }
  }
}

function mapGlobalPricingRecord(record: GlobalPricingRecord): GlobalPricingDto {
  return {
    defaultPricePerSeat: record.defaultPricePerSeat,
    nextPricePerSeat: record.nextPricePerSeat,
    nextPriceEffectiveAt: record.nextPriceEffectiveAt?.toISOString() ?? null,
    currency: record.currency,
    updatedAt: record.updatedAt.toISOString(),
  }
}

function mapSubscriptionInvoiceRecord(
  record: SubscriptionInvoiceRecord,
): SubscriptionInvoiceDto {
  return {
    id: record.id,
    billingPeriodStart: record.billingPeriodStart.toISOString(),
    billingPeriodEnd: record.billingPeriodEnd.toISOString(),
    peakSeats: record.peakSeats,
    pricePerSeat: record.pricePerSeat,
    amount: record.amount,
    currency: record.currency,
    status: record.status,
    dueAt: record.dueAt.toISOString(),
    gracePeriodEnd: record.gracePeriodEnd.toISOString(),
    paidAt: record.paidAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  }
}

function mapUniversitySubscriptionRecord(
  record: UniversitySubscriptionDetailsRecord,
): UniversitySubscriptionItemDto {
  return {
    universityId: record.universityId,
    universityName: record.universityName,
    universityCode: record.universityCode,
    universityStatus: record.universityStatus,
    subscriptionStatus: record.subscriptionStatus,
    cancelAtPeriodEnd: record.cancelAtPeriodEnd,
    canceledAt: record.canceledAt?.toISOString() ?? null,
    currentStudentsCount: record.currentStudentsCount,
    peakStudentsCount: record.peakStudentsCount,
    customPricePerSeat: record.customPricePerSeat,
    nextCustomPricePerSeat: record.nextCustomPricePerSeat,
    defaultPricePerSeat: record.defaultPricePerSeat,
    effectivePricePerSeat: record.effectivePricePerSeat,
    nextEffectivePricePerSeat: record.nextEffectivePricePerSeat,
    hasNextPriceChange: record.hasNextPriceChange,
    nextPriceEffectiveDate:
      record.nextPriceEffectiveDate?.toISOString() ?? null,
    isCustomPrice: record.isCustomPrice,
    estimatedMonthlyTotal: record.estimatedMonthlyTotal,
    currency: record.currency,
    billingPeriod: record.billingPeriod,
    billingPeriodStart: record.billingPeriodStart.toISOString(),
    billingPeriodEnd: record.billingPeriodEnd.toISOString(),
    nextBillingDate: record.nextBillingDate.toISOString(),
    gracePeriodEnd: record.gracePeriodEnd.toISOString(),
    isInGracePeriod: record.isInGracePeriod,
    isOverdue: record.isOverdue,
  }
}
