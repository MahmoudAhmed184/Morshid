import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { IdentityModule } from '../identity/identity.module'
import { PdfStorageModule } from '../../platform/document-storage/pdf-storage.module'
import { PrismaModule } from '../../platform/database/prisma.module'
import { ConversationTurns } from './conversation-turns'
import { ConversationAuthorization } from './conversation-authorization'
import { ConversationMessageReader } from './conversation-message-reader'
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
    ConversationAuthorization,
    ConversationMessageReader,
    ConversationAuditService,
    ConversationMessagePresenter,
    ConversationsService,
    ConversationSessionRepository,
    ConversationMessageRepository,
  ],
})
export class ConversationsModule {}
