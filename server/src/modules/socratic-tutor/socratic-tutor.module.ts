import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import {
  PrismaTopicStateRepository,
  TopicStateRepository,
} from './topic-state.repository'
import { TopicStateService } from './topic-state.service'
import { PrismaTopicRepository, TopicRepository } from './topic.repository'
import { TopicService } from './topic.service'

@Module({
  imports: [PrismaModule],
  providers: [
    TopicStateService,
    TopicService,
    {
      provide: TopicStateRepository,
      useClass: PrismaTopicStateRepository,
    },
    {
      provide: TopicRepository,
      useClass: PrismaTopicRepository,
    },
  ],
  exports: [TopicService, TopicStateService],
})
export class SocraticTutorModule {}
