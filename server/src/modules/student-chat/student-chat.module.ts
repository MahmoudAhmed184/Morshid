import { Module } from '@nestjs/common'

import { ConversationsModule } from '../conversations/conversations.module'
import { IdentityModule } from '../identity/identity.module'
import { TutoringModule } from '../tutoring/tutoring.module'
import { ConversationsController } from './conversations.controller'
import { ConversationCourseBoundaryAuditFilter } from './conversation-course-boundary-audit.filter'

@Module({
  imports: [ConversationsModule, IdentityModule, TutoringModule],
  controllers: [ConversationsController],
  providers: [ConversationCourseBoundaryAuditFilter],
})
export class StudentChatModule {}
