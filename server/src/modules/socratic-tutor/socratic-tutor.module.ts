import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { PrismaTopicRepository, TopicRepository } from './topic.repository'
import { TopicService } from './topic.service'

@Module({
  imports: [PrismaModule],
  providers: [
    TopicService,
    {
      provide: TopicRepository,
      useClass: PrismaTopicRepository,
    },
  ],
  exports: [TopicService],
})
export class SocraticTutorModule {}
