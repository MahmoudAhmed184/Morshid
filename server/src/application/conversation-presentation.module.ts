import { Global, Module } from '@nestjs/common'

import { ConversationMessagePresenter } from '../modules/conversations/interface/conversation-message-presenter'
import { MaterialsModule } from '../modules/materials/materials.module'
import { ReviewsModule } from '../modules/reviews/reviews.module'
import { ApplicationConversationMessagePresenter } from './conversation-message.presenter'

@Global()
@Module({
  imports: [MaterialsModule, ReviewsModule],
  providers: [
    {
      provide: ConversationMessagePresenter,
      useClass: ApplicationConversationMessagePresenter,
    },
  ],
  exports: [ConversationMessagePresenter],
})
export class ConversationPresentationModule {}
