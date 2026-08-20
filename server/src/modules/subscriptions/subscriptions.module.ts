import { Module } from '@nestjs/common'

import { PrismaModule } from '../../platform/database/prisma.module'
import { IdentityModule } from '../identity/identity.module'
import { SubscriptionsController } from './subscriptions.controller'
import {
  PrismaSubscriptionsRepository,
  SubscriptionsRepository,
} from './subscriptions.repository'
import { SubscriptionsService } from './subscriptions.service'
import { SubscriptionBillingLifecycle } from './subscription-billing-lifecycle'

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionBillingLifecycle,
    {
      provide: SubscriptionsRepository,
      useClass: PrismaSubscriptionsRepository,
    },
  ],
  exports: [SubscriptionsService, SubscriptionsRepository],
})
export class SubscriptionsModule {}
