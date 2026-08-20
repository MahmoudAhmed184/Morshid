import { Injectable } from '@nestjs/common'

import {
  Prisma,
  SubscriptionStatus as PrismaSubscriptionStatus,
  UniversityStatus,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'
import { PrismaService } from '../../platform/database/prisma.service'
import {
  SubscriptionStatus,
  type ListSubscriptionsQuery,
  type UpdateGlobalPricingRequest,
  type UpdateUniversitySubscriptionRequest,
} from './subscriptions.types'
import { UniversityNotFoundError } from './subscriptions.errors'
import {
  getInvoiceGracePeriodEnd,
  getInvoicePaymentState,
  getSubscriptionBillingPeriod,
} from './subscriptions.dates'

export interface GlobalPricingRecord {
  defaultPricePerSeat: number
  nextPricePerSeat: number | null
  nextPriceEffectiveAt: Date | null
  currency: string
  updatedAt: Date
}

export interface UniversitySubscriptionDetailsRecord {
  universityId: string
  universityName: string
  universityCode: string
  universityStatus: UniversityStatus
  subscriptionStatus: SubscriptionStatus
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
  currentStudentsCount: number
  peakStudentsCount: number
  customPricePerSeat: number | null
  nextCustomPricePerSeat: number | null
  defaultPricePerSeat: number
  effectivePricePerSeat: number
  nextEffectivePricePerSeat: number | null
  hasNextPriceChange: boolean
  nextPriceEffectiveDate: Date | null
  isCustomPrice: boolean
  estimatedMonthlyTotal: number
  currency: string
  billingPeriod: string
  billingPeriodStart: Date
  billingPeriodEnd: Date
  nextBillingDate: Date
  gracePeriodEnd: Date
  isInGracePeriod: boolean
  isOverdue: boolean
}

export interface SubscriptionsPageRecord {
  data: UniversitySubscriptionDetailsRecord[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
  summary: {
    totalSubscribedUniversities: number
    totalActiveStudents: number
    totalPeakStudents: number
    totalEstimatedRevenue: number
    defaultPricePerSeat: number
    currency: string
  }
}

export interface SubscriptionInvoiceRecord {
  id: string
  billingPeriodStart: Date
  billingPeriodEnd: Date
  peakSeats: number
  pricePerSeat: number
  amount: number
  currency: string
  status: 'DUE' | 'PAID'
  dueAt: Date
  gracePeriodEnd: Date
  paidAt: Date | null
  createdAt: Date
}

export abstract class SubscriptionsRepository {
  processBillingLifecycle(_now?: Date): Promise<void> {
    return Promise.resolve()
  }
  markInvoicePaid(_invoiceId: string): Promise<boolean> {
    return Promise.resolve(false)
  }
  listUniversityInvoices(
    _universityId: string,
  ): Promise<SubscriptionInvoiceRecord[]> {
    return Promise.resolve([])
  }
  abstract getGlobalPricing(): Promise<GlobalPricingRecord>
  abstract updateGlobalPricing(
    input: UpdateGlobalPricingRequest,
  ): Promise<GlobalPricingRecord>
  abstract listSubscriptions(
    query: ListSubscriptionsQuery,
  ): Promise<SubscriptionsPageRecord>
  abstract getUniversitySubscription(
    universityId: string,
  ): Promise<UniversitySubscriptionDetailsRecord>
  abstract updateUniversitySubscription(
    universityId: string,
    input: UpdateUniversitySubscriptionRequest,
  ): Promise<UniversitySubscriptionDetailsRecord>
  abstract cancelUniversitySubscription(
    universityId: string,
  ): Promise<UniversitySubscriptionDetailsRecord>
  abstract resumeUniversitySubscription(
    universityId: string,
  ): Promise<UniversitySubscriptionDetailsRecord>
}

@Injectable()
export class PrismaSubscriptionsRepository extends SubscriptionsRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async getGlobalPricing(): Promise<GlobalPricingRecord> {
    let config = await this.prismaService.globalPricingConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        defaultPricePerSeat: 10.0,
        currency: 'USD',
      },
    })

    const now = new Date()
    if (
      config.nextPricePerSeat !== null &&
      config.nextPriceEffectiveAt !== null &&
      now >= config.nextPriceEffectiveAt
    ) {
      config = await this.prismaService.globalPricingConfig.update({
        where: { id: 'default' },
        data: {
          defaultPricePerSeat: config.nextPricePerSeat,
          nextPricePerSeat: null,
          nextPriceEffectiveAt: null,
        },
      })
    }

    return {
      defaultPricePerSeat: config.defaultPricePerSeat,
      nextPricePerSeat: config.nextPricePerSeat,
      nextPriceEffectiveAt: config.nextPriceEffectiveAt,
      currency: config.currency,
      updatedAt: config.updatedAt,
    }
  }

  async processBillingLifecycle(
    now = new Date(),
    suppliedPricing?: GlobalPricingRecord,
  ): Promise<void> {
    const pricing = suppliedPricing ?? (await this.getGlobalPricing())
    const universities = await this.prismaService.university.findMany({
      select: { id: true },
    })

    for (const university of universities) {
      await this.processUniversityBilling(university.id, now, pricing)
    }
  }

  private async processUniversityBilling(
    universityId: string,
    now: Date,
    pricing: GlobalPricingRecord,
  ): Promise<void> {
    const university = await this.prismaService.university.findUnique({
      where: { id: universityId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        subscription: true,
      },
    })

    if (university === null) {
      return
    }

    let subscription =
      university.subscription ??
      (await this.prismaService.universitySubscription.create({
        data: {
          universityId,
          activatedAt: university.createdAt,
        },
      }))
    const period = getSubscriptionBillingPeriod(subscription.activatedAt, now)
    if (
      subscription.nextCustomPriceEffectiveAt !== null &&
      subscription.nextCustomPriceEffectiveAt <= period.start
    ) {
      subscription = await this.prismaService.universitySubscription.update({
        where: { id: subscription.id },
        data: {
          customPricePerSeat: subscription.nextCustomPricePerSeat,
          nextCustomPricePerSeat: null,
          nextCustomPriceEffectiveAt: null,
        },
      })
    }
    const pricePerSeat =
      subscription.customPricePerSeat ?? pricing.defaultPricePerSeat
    const activeStudents = await this.prismaService.user.count({
      where: {
        universityId,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      },
    })

    await this.prismaService.universityMonthlyUsage.upsert({
      where: {
        universityId_billingPeriod: {
          universityId,
          billingPeriod: period.period,
        },
      },
      update: {},
      create: {
        universityId,
        billingPeriod: period.period,
        billingPeriodStart: period.start,
        billingPeriodEnd: period.end,
        peakStudentsCount: activeStudents,
        pricePerSeat,
        currency: pricing.currency,
      },
    })

    // Never lower the high-water mark when reconciling the current seat count.
    await this.prismaService.$executeRaw`
      UPDATE university_monthly_usages
      SET peak_students_count = GREATEST(peak_students_count, ${activeStudents})
      WHERE university_id = ${universityId}::uuid
        AND billing_period = ${period.period}
    `

    const completedUsages =
      await this.prismaService.universityMonthlyUsage.findMany({
        where: {
          universityId,
          billingPeriodEnd: { lte: now },
        },
        orderBy: { billingPeriodStart: 'asc' },
      })

    for (const usage of completedUsages) {
      await this.prismaService.subscriptionInvoice.upsert({
        where: {
          universityId_billingPeriodStart: {
            universityId,
            billingPeriodStart: usage.billingPeriodStart,
          },
        },
        update: {},
        create: {
          subscriptionId: subscription.id,
          universityId,
          billingPeriodStart: usage.billingPeriodStart,
          billingPeriodEnd: usage.billingPeriodEnd,
          peakSeats: usage.peakStudentsCount,
          pricePerSeat: usage.pricePerSeat,
          amount: usage.peakStudentsCount * usage.pricePerSeat,
          currency: usage.currency,
          dueAt: usage.billingPeriodEnd,
          gracePeriodEnd: getInvoiceGracePeriodEnd(usage.billingPeriodEnd),
        },
      })
    }

    if (
      subscription.cancelAtPeriodEnd &&
      subscription.cancellationEffectiveAt !== null &&
      now >= subscription.cancellationEffectiveAt
    ) {
      await this.prismaService.$transaction([
        this.prismaService.universitySubscription.update({
          where: { id: subscription.id },
          data: { status: PrismaSubscriptionStatus.CANCELLED },
        }),
        this.prismaService.university.update({
          where: { id: universityId },
          data: { status: UniversityStatus.INACTIVE },
        }),
      ])
      return
    }

    const overdueInvoice =
      await this.prismaService.subscriptionInvoice.findFirst({
        where: {
          universityId,
          status: 'DUE',
          gracePeriodEnd: { lte: now },
        },
        select: { id: true },
      })

    if (
      overdueInvoice !== null &&
      university.status === UniversityStatus.ACTIVE
    ) {
      await this.prismaService.$transaction([
        this.prismaService.university.update({
          where: { id: universityId },
          data: { status: UniversityStatus.SUSPENDED },
        }),
        this.prismaService.universitySubscription.update({
          where: { id: subscription.id },
          data: { billingSuspendedAt: now },
        }),
      ])
    }
  }

  async markInvoicePaid(invoiceId: string): Promise<boolean> {
    const invoice = await this.prismaService.subscriptionInvoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, universityId: true, subscriptionId: true },
    })
    if (invoice === null) {
      return false
    }

    await this.prismaService.subscriptionInvoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
    })

    const [otherOverdue, subscription] = await Promise.all([
      this.prismaService.subscriptionInvoice.findFirst({
        where: {
          universityId: invoice.universityId,
          status: 'DUE',
          gracePeriodEnd: { lte: new Date() },
        },
        select: { id: true },
      }),
      this.prismaService.universitySubscription.findUnique({
        where: { id: invoice.subscriptionId },
        select: { billingSuspendedAt: true, status: true },
      }),
    ])

    if (
      otherOverdue === null &&
      subscription !== null &&
      subscription.billingSuspendedAt !== null &&
      subscription.status !== PrismaSubscriptionStatus.CANCELLED
    ) {
      await this.prismaService.$transaction([
        this.prismaService.university.update({
          where: { id: invoice.universityId },
          data: { status: UniversityStatus.ACTIVE },
        }),
        this.prismaService.universitySubscription.update({
          where: { id: invoice.subscriptionId },
          data: { billingSuspendedAt: null },
        }),
      ])
    }

    return true
  }

  async listUniversityInvoices(
    universityId: string,
  ): Promise<SubscriptionInvoiceRecord[]> {
    const university = await this.prismaService.university.findUnique({
      where: { id: universityId },
      select: { id: true },
    })
    if (university === null) {
      throw new UniversityNotFoundError(universityId)
    }

    await this.processUniversityBilling(
      universityId,
      new Date(),
      await this.getGlobalPricing(),
    )

    return this.prismaService.subscriptionInvoice.findMany({
      where: { universityId },
      select: {
        id: true,
        billingPeriodStart: true,
        billingPeriodEnd: true,
        peakSeats: true,
        pricePerSeat: true,
        amount: true,
        currency: true,
        status: true,
        dueAt: true,
        gracePeriodEnd: true,
        paidAt: true,
        createdAt: true,
      },
      orderBy: { billingPeriodStart: 'desc' },
    })
  }

  async updateGlobalPricing(
    input: UpdateGlobalPricingRequest,
  ): Promise<GlobalPricingRecord> {
    const config = await this.prismaService.globalPricingConfig.upsert({
      where: { id: 'default' },
      update: {
        defaultPricePerSeat: input.defaultPricePerSeat,
        nextPricePerSeat: null,
        nextPriceEffectiveAt: null,
        currency: input.currency,
      },
      create: {
        id: 'default',
        defaultPricePerSeat: input.defaultPricePerSeat,
        nextPricePerSeat: null,
        nextPriceEffectiveAt: null,
        currency: input.currency,
      },
    })

    return {
      defaultPricePerSeat: config.defaultPricePerSeat,
      nextPricePerSeat: config.nextPricePerSeat,
      nextPriceEffectiveAt: config.nextPriceEffectiveAt,
      currency: config.currency,
      updatedAt: config.updatedAt,
    }
  }

  async listSubscriptions(
    query: ListSubscriptionsQuery,
  ): Promise<SubscriptionsPageRecord> {
    const globalPricing = await this.getGlobalPricing()
    const now = new Date()

    await this.processBillingLifecycle(now, globalPricing)

    const where: Prisma.UniversityWhereInput = {
      ...(query.search !== undefined && query.search.length > 0
        ? {
            OR: [
              {
                name: {
                  contains: query.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                code: {
                  contains: query.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    }

    const allUniversities = await this.prismaService.university.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        createdAt: true,
        subscription: {
          select: {
            customPricePerSeat: true,
            status: true,
            cancelAtPeriodEnd: true,
            canceledAt: true,
            nextCustomPricePerSeat: true,
            nextCustomPriceEffectiveAt: true,
            createdAt: true,
            activatedAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Count active students per university
    const activeStudentsPerUniversity = await this.prismaService.user.groupBy({
      by: ['universityId'],
      where: {
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        universityId: { not: null },
      },
      _count: { _all: true },
    })

    const activeStudentsMap = new Map<string, number>()
    for (const item of activeStudentsPerUniversity) {
      if (item.universityId !== null && item.universityId.length > 0) {
        activeStudentsMap.set(item.universityId, item._count._all)
      }
    }

    // Build records per university calculating anniversary cycles
    const allRecords: UniversitySubscriptionDetailsRecord[] = []

    for (const uni of allUniversities) {
      const subscription = uni.subscription
      const startDate = subscription?.activatedAt ?? uni.createdAt
      const periodInfo = getSubscriptionBillingPeriod(startDate, now)

      const dueInvoice = await this.prismaService.subscriptionInvoice.findFirst(
        {
          where: { universityId: uni.id, status: 'DUE' },
          orderBy: { dueAt: 'asc' },
          select: { gracePeriodEnd: true },
        },
      )
      const gracePeriodEnd =
        dueInvoice?.gracePeriodEnd ?? periodInfo.gracePeriodEnd
      const { isInGracePeriod, isOverdue } = getInvoicePaymentState(
        dueInvoice?.gracePeriodEnd ?? null,
        now,
      )

      const currentStudents = activeStudentsMap.get(uni.id) ?? 0

      // Look up peak usage in the current anniversary period
      const usage = await this.prismaService.universityMonthlyUsage.findUnique({
        where: {
          universityId_billingPeriod: {
            universityId: uni.id,
            billingPeriod: periodInfo.period,
          },
        },
        select: {
          peakStudentsCount: true,
          pricePerSeat: true,
        },
      })

      const recordedPeak = usage?.peakStudentsCount ?? 0
      const peakStudents = Math.max(recordedPeak, currentStudents)

      if (usage === null || peakStudents > recordedPeak) {
        await this.prismaService.universityMonthlyUsage.upsert({
          where: {
            universityId_billingPeriod: {
              universityId: uni.id,
              billingPeriod: periodInfo.period,
            },
          },
          update: {
            peakStudentsCount: peakStudents,
          },
          create: {
            universityId: uni.id,
            billingPeriod: periodInfo.period,
            billingPeriodStart: periodInfo.start,
            billingPeriodEnd: periodInfo.end,
            peakStudentsCount: peakStudents,
            pricePerSeat:
              subscription?.customPricePerSeat ??
              globalPricing.defaultPricePerSeat,
            currency: globalPricing.currency,
          },
        })
      }

      let currentCustomPrice = subscription?.customPricePerSeat ?? null
      let nextCustomPrice = subscription?.nextCustomPricePerSeat ?? null
      const nextCustomPriceEffectiveAt =
        subscription?.nextCustomPriceEffectiveAt ?? null

      if (
        nextCustomPrice !== null &&
        nextCustomPriceEffectiveAt !== null &&
        now >= nextCustomPriceEffectiveAt &&
        subscription !== null
      ) {
        await this.prismaService.universitySubscription.update({
          where: { universityId: uni.id },
          data: {
            customPricePerSeat: nextCustomPrice,
            nextCustomPricePerSeat: null,
            nextCustomPriceEffectiveAt: null,
          },
        })
        currentCustomPrice = nextCustomPrice
        nextCustomPrice = null
      }

      let uniStatus = uni.status
      let subStatus =
        subscription !== null ? subscription.status : SubscriptionStatus.ACTIVE

      // If scheduled cancellation and period has ended: finalize cancellation and deactivate school
      if (
        subscription?.cancelAtPeriodEnd === true &&
        now >= periodInfo.end &&
        subStatus !== SubscriptionStatus.CANCELLED
      ) {
        await this.prismaService.$transaction([
          this.prismaService.universitySubscription.update({
            where: { universityId: uni.id },
            data: { status: PrismaSubscriptionStatus.CANCELLED },
          }),
          this.prismaService.university.update({
            where: { id: uni.id },
            data: { status: UniversityStatus.INACTIVE },
          }),
        ])
        subStatus = SubscriptionStatus.CANCELLED
        uniStatus = UniversityStatus.INACTIVE
      } else if (
        subscription?.cancelAtPeriodEnd === true &&
        subStatus === SubscriptionStatus.ACTIVE
      ) {
        subStatus = SubscriptionStatus.PENDING_CANCELLATION
      }

      const effectivePricePerSeat =
        usage?.pricePerSeat ??
        currentCustomPrice ??
        globalPricing.defaultPricePerSeat
      const isCustomPrice = currentCustomPrice !== null
      const estimatedMonthlyTotal = peakStudents * effectivePricePerSeat

      let nextEffectivePricePerSeat: number | null = null
      let hasNextPriceChange = false
      let nextPriceEffectiveDate: Date | null = null

      if (nextCustomPrice !== null) {
        nextEffectivePricePerSeat = nextCustomPrice
        hasNextPriceChange = true
        nextPriceEffectiveDate = periodInfo.nextBillingDate
      } else if (
        currentCustomPrice === null &&
        effectivePricePerSeat !== globalPricing.defaultPricePerSeat
      ) {
        nextEffectivePricePerSeat = globalPricing.defaultPricePerSeat
        hasNextPriceChange = true
        nextPriceEffectiveDate = periodInfo.nextBillingDate
      }

      allRecords.push({
        universityId: uni.id,
        universityName: uni.name,
        universityCode: uni.code,
        universityStatus: uniStatus,
        subscriptionStatus: subStatus,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
        canceledAt: subscription?.canceledAt ?? null,
        currentStudentsCount: currentStudents,
        peakStudentsCount: peakStudents,
        customPricePerSeat: currentCustomPrice,
        nextCustomPricePerSeat: nextCustomPrice,
        defaultPricePerSeat: globalPricing.defaultPricePerSeat,
        effectivePricePerSeat,
        nextEffectivePricePerSeat,
        hasNextPriceChange,
        nextPriceEffectiveDate,
        isCustomPrice,
        estimatedMonthlyTotal,
        currency: globalPricing.currency,
        billingPeriod: periodInfo.period,
        billingPeriodStart: periodInfo.start,
        billingPeriodEnd: periodInfo.end,
        nextBillingDate: periodInfo.nextBillingDate,
        gracePeriodEnd,
        isInGracePeriod,
        isOverdue,
      })
    }

    // Filter by status if specified
    let filteredRecords = allRecords
    if (query.status !== undefined) {
      filteredRecords = allRecords.filter(
        (rec) => rec.subscriptionStatus === query.status,
      )
    }

    // Sort records
    filteredRecords.sort((a, b) => {
      let comparison: number
      switch (query.sortBy) {
        case 'code':
          comparison = a.universityCode.localeCompare(b.universityCode)
          break
        case 'studentsCount':
          comparison = a.currentStudentsCount - b.currentStudentsCount
          break
        case 'peakStudentsCount':
          comparison = a.peakStudentsCount - b.peakStudentsCount
          break
        case 'effectivePricePerSeat':
          comparison = a.effectivePricePerSeat - b.effectivePricePerSeat
          break
        case 'estimatedMonthlyTotal':
          comparison = a.estimatedMonthlyTotal - b.estimatedMonthlyTotal
          break
        case 'createdAt':
          comparison =
            a.billingPeriodStart.getTime() - b.billingPeriodStart.getTime()
          break
        case 'name':
        default:
          comparison = a.universityName.localeCompare(b.universityName)
          break
      }

      return query.sortOrder === 'desc' ? -comparison : comparison
    })

    // Compute overall summary across all universities (unpaginated)
    const totalSubscribedUniversities = allRecords.filter(
      (r) => r.subscriptionStatus !== SubscriptionStatus.CANCELLED,
    ).length
    const totalActiveStudents = allRecords.reduce(
      (sum, r) => sum + r.currentStudentsCount,
      0,
    )
    const totalPeakStudents = allRecords.reduce(
      (sum, r) => sum + r.peakStudentsCount,
      0,
    )
    const totalEstimatedRevenue = allRecords.reduce(
      (sum, r) =>
        r.subscriptionStatus !== SubscriptionStatus.CANCELLED
          ? sum + r.estimatedMonthlyTotal
          : sum,
      0,
    )

    // Paginate
    const totalCount = filteredRecords.length
    const totalPages =
      totalCount === 0 ? 0 : Math.ceil(totalCount / query.limit)
    const skip = (query.page - 1) * query.limit
    const paginatedData = filteredRecords.slice(skip, skip + query.limit)

    return {
      data: paginatedData,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages,
      },
      summary: {
        totalSubscribedUniversities,
        totalActiveStudents,
        totalPeakStudents,
        totalEstimatedRevenue,
        defaultPricePerSeat: globalPricing.defaultPricePerSeat,
        currency: globalPricing.currency,
      },
    }
  }

  async getUniversitySubscription(
    universityId: string,
  ): Promise<UniversitySubscriptionDetailsRecord> {
    const globalPricing = await this.getGlobalPricing()
    const now = new Date()
    await this.processUniversityBilling(universityId, now, globalPricing)

    const university = await this.prismaService.university.findUnique({
      where: { id: universityId },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        createdAt: true,
        subscription: {
          select: {
            customPricePerSeat: true,
            status: true,
            cancelAtPeriodEnd: true,
            canceledAt: true,
            nextCustomPricePerSeat: true,
            nextCustomPriceEffectiveAt: true,
            createdAt: true,
            activatedAt: true,
          },
        },
      },
    })

    if (university === null) {
      throw new UniversityNotFoundError(universityId)
    }

    const startDate =
      university.subscription?.activatedAt ?? university.createdAt
    const periodInfo = getSubscriptionBillingPeriod(startDate, now)
    const dueInvoice = await this.prismaService.subscriptionInvoice.findFirst({
      where: { universityId, status: 'DUE' },
      orderBy: { dueAt: 'asc' },
      select: { gracePeriodEnd: true },
    })
    const gracePeriodEnd =
      dueInvoice?.gracePeriodEnd ?? periodInfo.gracePeriodEnd
    const { isInGracePeriod, isOverdue } = getInvoicePaymentState(
      dueInvoice?.gracePeriodEnd ?? null,
      now,
    )

    // Count active students
    const activeStudentsCount = await this.prismaService.user.count({
      where: {
        universityId,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      },
    })

    // Find or create usage in anniversary period
    const usage = await this.prismaService.universityMonthlyUsage.findUnique({
      where: {
        universityId_billingPeriod: {
          universityId,
          billingPeriod: periodInfo.period,
        },
      },
    })

    const recordedPeak = usage?.peakStudentsCount ?? 0
    const peakStudentsCount = Math.max(recordedPeak, activeStudentsCount)

    if (usage === null || peakStudentsCount > recordedPeak) {
      await this.prismaService.universityMonthlyUsage.upsert({
        where: {
          universityId_billingPeriod: {
            universityId,
            billingPeriod: periodInfo.period,
          },
        },
        update: {
          peakStudentsCount,
        },
        create: {
          universityId,
          billingPeriod: periodInfo.period,
          billingPeriodStart: periodInfo.start,
          billingPeriodEnd: periodInfo.end,
          peakStudentsCount,
          pricePerSeat:
            university.subscription?.customPricePerSeat ??
            globalPricing.defaultPricePerSeat,
          currency: globalPricing.currency,
        },
      })
    }

    const subscription = university.subscription
    let currentCustomPrice = subscription?.customPricePerSeat ?? null
    let nextCustomPrice = subscription?.nextCustomPricePerSeat ?? null
    const nextCustomPriceEffectiveAt =
      subscription?.nextCustomPriceEffectiveAt ?? null

    if (
      nextCustomPrice !== null &&
      nextCustomPriceEffectiveAt !== null &&
      now >= nextCustomPriceEffectiveAt &&
      subscription !== null
    ) {
      await this.prismaService.universitySubscription.update({
        where: { universityId },
        data: {
          customPricePerSeat: nextCustomPrice,
          nextCustomPricePerSeat: null,
          nextCustomPriceEffectiveAt: null,
        },
      })
      currentCustomPrice = nextCustomPrice
      nextCustomPrice = null
    }

    let uniStatus = university.status
    let subStatus =
      subscription !== null ? subscription.status : SubscriptionStatus.ACTIVE

    // If scheduled cancellation and period has ended: finalize cancellation and deactivate school
    if (
      subscription?.cancelAtPeriodEnd === true &&
      now >= periodInfo.end &&
      subStatus !== SubscriptionStatus.CANCELLED
    ) {
      await this.prismaService.$transaction([
        this.prismaService.universitySubscription.update({
          where: { universityId },
          data: { status: PrismaSubscriptionStatus.CANCELLED },
        }),
        this.prismaService.university.update({
          where: { id: universityId },
          data: { status: UniversityStatus.INACTIVE },
        }),
      ])
      subStatus = SubscriptionStatus.CANCELLED
      uniStatus = UniversityStatus.INACTIVE
    } else if (
      subscription?.cancelAtPeriodEnd === true &&
      subStatus === SubscriptionStatus.ACTIVE
    ) {
      subStatus = SubscriptionStatus.PENDING_CANCELLATION
    }

    const effectivePricePerSeat =
      usage?.pricePerSeat ??
      currentCustomPrice ??
      globalPricing.defaultPricePerSeat
    const isCustomPrice = currentCustomPrice !== null
    const estimatedMonthlyTotal = peakStudentsCount * effectivePricePerSeat

    let nextEffectivePricePerSeat: number | null = null
    let hasNextPriceChange = false
    let nextPriceEffectiveDate: Date | null = null

    if (nextCustomPrice !== null) {
      nextEffectivePricePerSeat = nextCustomPrice
      hasNextPriceChange = true
      nextPriceEffectiveDate = periodInfo.nextBillingDate
    } else if (
      currentCustomPrice === null &&
      effectivePricePerSeat !== globalPricing.defaultPricePerSeat
    ) {
      nextEffectivePricePerSeat = globalPricing.defaultPricePerSeat
      hasNextPriceChange = true
      nextPriceEffectiveDate = periodInfo.nextBillingDate
    }

    return {
      universityId: university.id,
      universityName: university.name,
      universityCode: university.code,
      universityStatus: uniStatus,
      subscriptionStatus: subStatus,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      canceledAt: subscription?.canceledAt ?? null,
      currentStudentsCount: activeStudentsCount,
      peakStudentsCount,
      customPricePerSeat: currentCustomPrice,
      nextCustomPricePerSeat: nextCustomPrice,
      defaultPricePerSeat: globalPricing.defaultPricePerSeat,
      effectivePricePerSeat,
      nextEffectivePricePerSeat,
      hasNextPriceChange,
      nextPriceEffectiveDate,
      isCustomPrice,
      estimatedMonthlyTotal,
      currency: globalPricing.currency,
      billingPeriod: periodInfo.period,
      billingPeriodStart: periodInfo.start,
      billingPeriodEnd: periodInfo.end,
      nextBillingDate: periodInfo.nextBillingDate,
      gracePeriodEnd,
      isInGracePeriod,
      isOverdue,
    }
  }

  async updateUniversitySubscription(
    universityId: string,
    input: UpdateUniversitySubscriptionRequest,
  ): Promise<UniversitySubscriptionDetailsRecord> {
    const university = await this.prismaService.university.findUnique({
      where: { id: universityId },
      select: {
        id: true,
        createdAt: true,
        subscription: {
          select: {
            activatedAt: true,
          },
        },
      },
    })

    if (university === null) {
      throw new UniversityNotFoundError(universityId)
    }

    const startDate =
      university.subscription?.activatedAt ?? university.createdAt
    const { nextBillingDate } = getSubscriptionBillingPeriod(startDate)
    const cancelAtPeriodEnd = input.cancelAtPeriodEnd === true

    await this.prismaService.universitySubscription.upsert({
      where: { universityId },
      update: {
        ...(input.customPricePerSeat !== undefined
          ? {
              nextCustomPricePerSeat: input.customPricePerSeat,
              nextCustomPriceEffectiveAt: nextBillingDate,
            }
          : {}),
        ...(input.cancelAtPeriodEnd !== undefined
          ? {
              cancelAtPeriodEnd,
              canceledAt: cancelAtPeriodEnd ? new Date() : null,
              cancellationEffectiveAt: cancelAtPeriodEnd
                ? nextBillingDate
                : null,
            }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      create: {
        universityId,
        customPricePerSeat: input.customPricePerSeat ?? null,
        nextCustomPricePerSeat: null,
        nextCustomPriceEffectiveAt: null,
        cancelAtPeriodEnd,
        canceledAt: cancelAtPeriodEnd ? new Date() : null,
        cancellationEffectiveAt: cancelAtPeriodEnd ? nextBillingDate : null,
        status: input.status ?? PrismaSubscriptionStatus.ACTIVE,
      },
    })

    return this.getUniversitySubscription(universityId)
  }

  async cancelUniversitySubscription(
    universityId: string,
  ): Promise<UniversitySubscriptionDetailsRecord> {
    return this.updateUniversitySubscription(universityId, {
      cancelAtPeriodEnd: true,
      status: SubscriptionStatus.PENDING_CANCELLATION,
    })
  }

  async resumeUniversitySubscription(
    universityId: string,
  ): Promise<UniversitySubscriptionDetailsRecord> {
    return this.updateUniversitySubscription(universityId, {
      cancelAtPeriodEnd: false,
      status: SubscriptionStatus.ACTIVE,
    })
  }
}
