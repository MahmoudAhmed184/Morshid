import { Global, Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'

import { ConversationMessagePresenter } from '../modules/conversations/interface/conversation-message-presenter'
import { ConversationsModule } from '../modules/conversations/conversations.module'
import { MaterialsModule } from '../modules/materials/materials.module'
import { ReviewsModule } from '../modules/reviews/reviews.module'
import { ConversationCourseBoundaryAuditFilter } from './conversation-course-boundary-audit.filter'
import { ApplicationConversationMessagePresenter } from './conversation-message.presenter'

@Global()
@Module({
  imports: [ConversationsModule, MaterialsModule, ReviewsModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ConversationCourseBoundaryAuditFilter,
    },
    {
      provide: ConversationMessagePresenter,
      useClass: ApplicationConversationMessagePresenter,
    },
  ],
  exports: [ConversationMessagePresenter],
})
export class ConversationPresentationModule {}
