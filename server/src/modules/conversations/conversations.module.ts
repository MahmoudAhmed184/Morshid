import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { IdentityModule } from '../identity/identity.module'
import { PdfStorageModule } from '../pdf-storage/pdf-storage.module'
import { PrismaModule } from '../prisma/prisma.module'
import { ConversationTurns } from './conversation-turns'
import { PrismaConversationTurns } from './prisma-conversation-turns'
import { ConversationAuditService } from './conversation-audit.service'
import {
  PrismaConversationMessageRepository,
  ConversationMessageRepository,
} from './conversation-message.repository'
import { ConversationMessagePresenter } from './conversation-message.presenter'
import {
  PrismaConversationSessionRepository,
  ConversationSessionRepository,
} from './conversation-session.repository'
import { ConversationsService } from './conversations.service'

@Module({
  imports: [AuditModule, IdentityModule, PdfStorageModule, PrismaModule],
  providers: [
    {
      provide: ConversationTurns,
      useClass: PrismaConversationTurns,
    },
    ConversationAuditService,
    ConversationMessagePresenter,
    ConversationsService,
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
    ConversationTurns,
    ConversationAuditService,
    ConversationMessagePresenter,
    ConversationsService,
    ConversationSessionRepository,
    ConversationMessageRepository,
  ],
})
export class ConversationsModule {}
