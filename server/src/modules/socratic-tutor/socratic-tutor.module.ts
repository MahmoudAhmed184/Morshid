import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import {
  PrismaTopicStateRepository,
  TopicStateRepository,
} from './topic-state.repository'
import { TopicStateService } from './topic-state.service'
import { PrismaTurnRepository, TurnRepository } from './turn.repository'
import { TurnService } from './turn.service'
import { PrismaTopicRepository, TopicRepository } from './topic.repository'
import { TopicService } from './topic.service'

@Module({
  imports: [PrismaModule],
  providers: [
    TopicStateService,
    TopicService,
    TurnService,
    {
      provide: TopicStateRepository,
      useClass: PrismaTopicStateRepository,
    },
    {
      provide: TopicRepository,
      useClass: PrismaTopicRepository,
    },
    {
      provide: TurnRepository,
      useClass: PrismaTurnRepository,
    },
  ],
  exports: [TopicService, TopicStateService, TurnService],
})
export class SocraticTutorModule {}
