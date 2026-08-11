import { Module } from '@nestjs/common'

import { ConversationsModule } from '../conversations/conversations.module'
import { IdentityModule } from '../identity/identity.module'
import { ConversationsController } from './conversations.controller'
import { ConversationCourseBoundaryAuditFilter } from './interface/conversation-course-boundary-audit.filter'

@Module({
  imports: [ConversationsModule, IdentityModule],
  controllers: [ConversationsController],
  providers: [ConversationCourseBoundaryAuditFilter],
})
export class ConversationsHttpModule {}
