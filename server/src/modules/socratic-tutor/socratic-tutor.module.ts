import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import { PrismaModule } from '../prisma/prisma.module'
import { ANALYSIS_MODEL_PORT } from './analysis-model.port'
import {
  DETERMINISTIC_ANALYSIS_MODEL_PROVIDER,
  OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER,
} from './analysis-model.configuration'
import { createAnalysisModelPort } from './analysis-model.provider'
import {
  AnalysisContextRepository,
  PrismaAnalysisContextRepository,
} from './analysis-context.repository'
import { ContextManager } from './context-manager.service'
import {
  EducationalAnalysisRepository,
  PrismaEducationalAnalysisRepository,
} from './educational-analysis.repository'
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
    {
      provide: EducationalAnalysisRepository,
      useClass: PrismaEducationalAnalysisRepository,
    },
    {
      provide: ANALYSIS_MODEL_PORT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvironment, true>) => {
        const provider = configService.get('ANALYSIS_MODEL_PROVIDER', {
          infer: true,
        })
        const timeoutMs = configService.get('ANALYSIS_MODEL_TIMEOUT_MS', {
          infer: true,
        })

        if (provider === OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER) {
          return createAnalysisModelPort({
            provider,
            timeoutMs,
            openAICompatible: {
              baseUrl: configService.get('ANALYSIS_MODEL_BASE_URL', {
                infer: true,
              }),
              modelName: configService.get('ANALYSIS_MODEL_NAME', {
                infer: true,
              }),
              apiKey: configService.get('ANALYSIS_MODEL_API_KEY', {
                infer: true,
              }),
            },
          })
        }

        return createAnalysisModelPort({
          provider: DETERMINISTIC_ANALYSIS_MODEL_PROVIDER,
          timeoutMs,
        })
      },
    },
  ],
  exports: [
    TopicService,
    TopicStateService,
    TurnService,
    ContextManager,
    EducationalAnalysisRepository,
    ANALYSIS_MODEL_PORT,
  ],
})
export class SocraticTutorModule {}
