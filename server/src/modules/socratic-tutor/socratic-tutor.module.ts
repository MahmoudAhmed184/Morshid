import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import {
  AnalysisContextRepository,
  PrismaAnalysisContextRepository,
} from './analysis-context.repository'
import { ContextManager } from './context-manager.service'
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
    ContextManager,
    {
      provide: TopicStateRepository,
      useClass: PrismaTopicStateRepository,
    },
    {
      provide: AnalysisContextRepository,
      useClass: PrismaAnalysisContextRepository,
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
  exports: [TopicService, TopicStateService, TurnService, ContextManager],
})
export class SocraticTutorModule {}
