import { Module } from '@nestjs/common'

import { IdentityModule } from '../identity/identity.module'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsController } from './notifications.controller'
import {
  NotificationsRepository,
  PrismaNotificationsRepository,
} from './notifications.repository'
import { NotificationsService } from './notifications.service'

@Module({
  imports: [IdentityModule, PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    {
      provide: NotificationsRepository,
      useClass: PrismaNotificationsRepository,
    },
  ],
})
export class NotificationsModule {}
