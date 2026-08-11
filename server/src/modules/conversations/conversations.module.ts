import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { ConversationTurns } from './conversation-turns'
import { PrismaConversationTurns } from './prisma-conversation-turns'

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: ConversationTurns,
      useClass: PrismaConversationTurns,
    },
  ],
  exports: [ConversationTurns],
})
export class ConversationsModule {}
