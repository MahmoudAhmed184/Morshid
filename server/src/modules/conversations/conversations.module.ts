import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { IdentityModule } from '../identity/identity.module'
import { PrismaModule } from '../../platform/database/prisma.module'
import { ConversationTurns } from './interface/conversation-turns'
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
import { ConversationCourseBoundaryAuditFilter } from './interface/conversation-course-boundary-audit.filter'

@Module({
  imports: [AuditModule, IdentityModule, PrismaModule],
  controllers: [ConversationsController],
  providers: [
    PrismaConversationTurns,
    {
      provide: ConversationTurns,
      useExisting: PrismaConversationTurns,
    },
    ConversationAuditService,
    ConversationsService,
    ConversationCourseBoundaryAuditFilter,
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
  exports: [ConversationTurns, ConversationCourseBoundaryAudit],
})
export class ConversationsModule {}
