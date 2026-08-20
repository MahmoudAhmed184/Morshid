import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common'

import { SubscriptionsRepository } from './subscriptions.repository'

const BILLING_RECONCILIATION_INTERVAL_MS = 60_000

@Injectable()
export class SubscriptionBillingLifecycle
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SubscriptionBillingLifecycle.name)
  private interval: NodeJS.Timeout | undefined
  private isRunning = false

  constructor(
    private readonly subscriptionsRepository: SubscriptionsRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.reconcile()
    this.interval = setInterval(() => {
      void this.reconcile()
    }, BILLING_RECONCILIATION_INTERVAL_MS)
    this.interval.unref()
  }

  onModuleDestroy(): void {
    if (this.interval !== undefined) {
      clearInterval(this.interval)
    }
  }

  private async reconcile(): Promise<void> {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    try {
      await this.subscriptionsRepository.processBillingLifecycle()
    } catch (error) {
      this.logger.error('Subscription billing reconciliation failed', error)
    } finally {
      this.isRunning = false
    }
  }
}
