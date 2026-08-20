import {
  SubscriptionStatus,
  UniversityStatus,
} from '../../generated/prisma/client'
import type { PrismaService } from '../../platform/database/prisma.service'
import {
  PrismaSubscriptionsRepository,
  type UniversitySubscriptionDetailsRecord,
} from './subscriptions.repository'

const universityId = '00000000-0000-4000-8000-000000000001'
const activatedAt = new Date('2026-08-01T00:00:00.000Z')

const subscriptionRecord: UniversitySubscriptionDetailsRecord = {
  universityId,
  universityName: 'Morshid Demo University',
  universityCode: 'MORSHID-DEMO',
  universityStatus: UniversityStatus.ACTIVE,
  subscriptionStatus: SubscriptionStatus.ACTIVE,
  cancelAtPeriodEnd: false,
  canceledAt: null,
  currentStudentsCount: 3,
  peakStudentsCount: 3,
  customPricePerSeat: null,
  nextCustomPricePerSeat: null,
  defaultPricePerSeat: 8,
  effectivePricePerSeat: 8,
  nextEffectivePricePerSeat: null,
  hasNextPriceChange: false,
  nextPriceEffectiveDate: null,
  isCustomPrice: false,
  estimatedMonthlyTotal: 24,
  currency: 'USD',
  billingPeriod: '2026-08-01_2026-09-01',
  billingPeriodStart: activatedAt,
  billingPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
  nextBillingDate: new Date('2026-09-01T00:00:00.000Z'),
  gracePeriodEnd: new Date('2026-09-08T00:00:00.000Z'),
  isInGracePeriod: false,
  isOverdue: false,
}

function buildRepository(universityStatus: UniversityStatus) {
  const transactionClient = {
    universitySubscription: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    university: {
      update: jest.fn().mockResolvedValue({}),
    },
  }
  const prismaService = {
    university: {
      findUnique: jest.fn().mockResolvedValue({
        id: universityId,
        createdAt: activatedAt,
        status: universityStatus,
        subscription: { activatedAt },
      }),
    },
    $transaction: jest.fn(
      (callback: (client: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    ),
  }
  const repository = new PrismaSubscriptionsRepository(
    prismaService as unknown as PrismaService,
  )
  jest
    .spyOn(repository, 'getUniversitySubscription')
    .mockResolvedValue(subscriptionRecord)

  return { repository, transactionClient }
}

describe('PrismaSubscriptionsRepository subscription lifecycle updates', () => {
  it('immediately deactivates the university when its subscription is cancelled', async () => {
    const { repository, transactionClient } = buildRepository(
      UniversityStatus.ACTIVE,
    )

    await repository.updateUniversitySubscription(universityId, {
      status: SubscriptionStatus.CANCELLED,
    })

    const [upsertInput] = transactionClient.universitySubscription.upsert.mock
      .calls[0] as [
      {
        update: {
          status: SubscriptionStatus
          cancelAtPeriodEnd: boolean
          canceledAt: Date | null
          cancellationEffectiveAt: Date | null
        }
      },
    ]
    expect(upsertInput.update).toMatchObject({
      status: SubscriptionStatus.CANCELLED,
      cancelAtPeriodEnd: false,
    })
    expect(upsertInput.update.canceledAt).toBeInstanceOf(Date)
    expect(upsertInput.update.cancellationEffectiveAt).toBeInstanceOf(Date)
    expect(transactionClient.university.update).toHaveBeenCalledWith({
      where: { id: universityId },
      data: { status: UniversityStatus.INACTIVE },
    })
  })

  it('reactivates an inactive university when its subscription is resumed', async () => {
    const { repository, transactionClient } = buildRepository(
      UniversityStatus.INACTIVE,
    )

    await repository.updateUniversitySubscription(universityId, {
      status: SubscriptionStatus.ACTIVE,
    })

    expect(transactionClient.university.update).toHaveBeenCalledWith({
      where: { id: universityId },
      data: { status: UniversityStatus.ACTIVE },
    })
  })

  it('reactivates an inactive university until a scheduled cancellation takes effect', async () => {
    const { repository, transactionClient } = buildRepository(
      UniversityStatus.INACTIVE,
    )

    await repository.updateUniversitySubscription(universityId, {
      status: SubscriptionStatus.PENDING_CANCELLATION,
    })

    expect(transactionClient.university.update).toHaveBeenCalledWith({
      where: { id: universityId },
      data: { status: UniversityStatus.ACTIVE },
    })
  })

  it('does not clear a billing suspension when changing the subscription to active', async () => {
    const { repository, transactionClient } = buildRepository(
      UniversityStatus.SUSPENDED,
    )

    await repository.updateUniversitySubscription(universityId, {
      status: SubscriptionStatus.ACTIVE,
    })

    expect(transactionClient.university.update).not.toHaveBeenCalled()
  })
})
