import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { IdentityModule } from '../identity/identity.module'
import { MaterialsModule } from '../materials/materials.module'
import { ReviewsModule } from '../reviews/reviews.module'
import { PrismaModule } from '../../platform/database/prisma.module'
import { ConversationTurns } from './interface/conversation-turns'
import { ConversationAuthorization } from './interface/conversation-authorization'
import { ConversationMessageReader } from './interface/conversation-message-reader'
import { PrismaConversationTurns } from './prisma-conversation-turns'
import { ConversationAuditService } from './conversation-audit.service'
import {
  PrismaConversationMessageRepository,
  ConversationMessageRepository,
} from './conversation-message.repository'
import {
  PrismaConversationSessionRepository,
  ConversationSessionRepository,
} from './conversation-session.repository'
import { ConversationsService } from './conversations.service'
import { ConversationCourseBoundaryAudit } from './interface/conversation-course-boundary-audit'
import { ConversationsController } from './conversations.controller'

@Module({
  imports: [
    AuditModule,
    IdentityModule,
    PrismaModule,
    MaterialsModule,
    ReviewsModule,
  ],
  controllers: [ConversationsController],
  providers: [
    PrismaConversationTurns,
    {
      provide: ConversationTurns,
      useExisting: PrismaConversationTurns,
    },
    {
      provide: ConversationAuthorization,
      useExisting: PrismaConversationTurns,
    },
    {
      provide: ConversationMessageReader,
      useExisting: PrismaConversationTurns,
    },
    ConversationAuditService,
    ConversationsService,
    {
      provide: ConversationCourseBoundaryAudit,
      useExisting: ConversationsService,
    },
    {
      provide: ConversationSessionRepository,
      useClass: PrismaConversationSessionRepository,
    },
    {
      provide: ConversationMessageRepository,
      useClass: PrismaConversationMessageRepository,
    },
  ],
  exports: [
    ConversationAuthorization,
    ConversationMessageReader,
    ConversationTurns,
    ConversationCourseBoundaryAudit,
  ],
})
export class ConversationsModule {}
