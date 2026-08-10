import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import { PrismaModule } from '../prisma/prisma.module'
import {
  ANALYSIS_CONFIDENCE_POLICY,
  AnalysisConfidencePolicy,
} from './analysis-confidence-policy'
import { AnalysisFallbackBuilder } from './analysis-fallback-builder'
import { ANALYSIS_MODEL_PORT } from './analysis-model.port'
import {
  DETERMINISTIC_ANALYSIS_MODEL_PROVIDER,
  OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER,
} from './analysis-model.configuration'
import { createAnalysisModelPort } from './analysis-model.provider'
import {
  ANALYSIS_RETRY_POLICY,
  AnalysisRetryPolicy,
} from './analysis-retry-policy'
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
  PrismaTeachingDecisionRepository,
  TeachingDecisionRepository,
} from './teaching-decision.repository'
import { TeachingPolicyEngine } from './teaching-policy.engine'
import { EducationalAnalysisService } from './educational-analysis.service'
import {
  PrismaTopicStateRepository,
  TopicStateRepository,
} from './topic-state.repository'
import { TopicStateService } from './topic-state.service'
import { TUTOR_MODEL_PORT } from './tutor-generation.types'
import {
  DETERMINISTIC_TUTOR_MODEL_PROVIDER,
  OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER,
} from './tutor-model.configuration'
import { createTutorModelPort } from './tutor-model.adapter'
import { TutorGenerationService } from './tutor-generation.service'
import {
  TUTOR_INFRASTRUCTURE_RETRY_POLICY,
  TutorInfrastructureRetryPolicy,
} from './tutor-infrastructure-retry.policy'
import { PrismaTurnRepository, TurnRepository } from './turn.repository'
import { TurnService } from './turn.service'
import { PrismaTopicRepository, TopicRepository } from './topic.repository'
import { TopicService } from './topic.service'
import { StructuralResponseValidator } from './structural-response.validator'
import { DeterministicGuardService } from './deterministic-guard.service'
import { SemanticGuardService } from './semantic-guard.service'
import { SafeFallbackService } from './safe-fallback.service'
import { ResponseApprovalService } from './response-approval.service'
import { SEMANTIC_GUARD_PORT } from './semantic-guard.types'
import {
  DEFAULT_SEMANTIC_GUARD_BASE_URL,
  DEFAULT_SEMANTIC_GUARD_MODEL_NAME,
  DEFAULT_SEMANTIC_GUARD_TIMEOUT_MS,
  DETERMINISTIC_SEMANTIC_GUARD_PROVIDER,
  OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER,
} from './semantic-guard.configuration'
import { createSemanticGuardPort } from './semantic-guard.adapter'
import { RetrievalQueryBuilder } from './retrieval-query.builder'

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    TopicStateService,
    TopicService,
    TurnService,
    ContextManager,
    AnalysisFallbackBuilder,
    EducationalAnalysisService,
    TeachingPolicyEngine,
    TutorGenerationService,
    StructuralResponseValidator,
    DeterministicGuardService,
    SemanticGuardService,
    SafeFallbackService,
    ResponseApprovalService,
    RetrievalQueryBuilder,
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
      provide: TeachingDecisionRepository,
      useClass: PrismaTeachingDecisionRepository,
    },
    {
      provide: ANALYSIS_CONFIDENCE_POLICY,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvironment, true>) =>
        new AnalysisConfidencePolicy({
          threshold: configService.get('ANALYSIS_CONFIDENCE_THRESHOLD', {
            infer: true,
          }),
        }),
    },
    {
      provide: ANALYSIS_RETRY_POLICY,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvironment, true>) =>
        new AnalysisRetryPolicy(
          configService.get('ANALYSIS_MODEL_MAX_RETRIES', {
            infer: true,
          }),
        ),
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
    {
      provide: TUTOR_INFRASTRUCTURE_RETRY_POLICY,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvironment, true>) =>
        new TutorInfrastructureRetryPolicy(
          configService.get('TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES', {
            infer: true,
          }),
        ),
    },
    {
      provide: TUTOR_MODEL_PORT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvironment, true>) => {
        const provider = configService.get('TUTOR_MODEL_PROVIDER', {
          infer: true,
        })
        const timeoutMs = configService.get('TUTOR_MODEL_TIMEOUT_MS', {
          infer: true,
        })

        if (provider === OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER) {
          return createTutorModelPort({
            provider,
            timeoutMs,
            openAICompatible: {
              baseUrl: configService.get('TUTOR_MODEL_BASE_URL', {
                infer: true,
              }),
              modelName: configService.get('TUTOR_MODEL_NAME', {
                infer: true,
              }),
              apiKey: configService.get('TUTOR_MODEL_API_KEY', {
                infer: true,
              }),
            },
          })
        }

        return createTutorModelPort({
          provider: DETERMINISTIC_TUTOR_MODEL_PROVIDER,
          timeoutMs,
        })
      },
    },
    {
      provide: SEMANTIC_GUARD_PORT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvironment, true>) => {
        const configuredProvider: unknown = configService.get(
          'SEMANTIC_GUARD_PROVIDER',
          {
            infer: true,
          },
        )
        const provider =
          configuredProvider === OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER
            ? OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER
            : DETERMINISTIC_SEMANTIC_GUARD_PROVIDER
        const configuredTimeoutMs: unknown = configService.get(
          'SEMANTIC_GUARD_TIMEOUT_MS',
          {
            infer: true,
          },
        )
        const timeoutMs =
          typeof configuredTimeoutMs === 'number'
            ? configuredTimeoutMs
            : DEFAULT_SEMANTIC_GUARD_TIMEOUT_MS

        if (provider === OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER) {
          return createSemanticGuardPort({
            provider,
            timeoutMs,
            openAICompatible: {
              baseUrl: stringConfigValue(
                configService.get('SEMANTIC_GUARD_BASE_URL', {
                  infer: true,
                }),
                DEFAULT_SEMANTIC_GUARD_BASE_URL,
              ),
              modelName: stringConfigValue(
                configService.get('SEMANTIC_GUARD_MODEL_NAME', {
                  infer: true,
                }),
                DEFAULT_SEMANTIC_GUARD_MODEL_NAME,
              ),
              apiKey: stringConfigValue(
                configService.get('SEMANTIC_GUARD_API_KEY', {
                  infer: true,
                }),
                '',
              ),
            },
          })
        }

        return createSemanticGuardPort({
          provider: DETERMINISTIC_SEMANTIC_GUARD_PROVIDER,
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
    EducationalAnalysisService,
    EducationalAnalysisRepository,
    TeachingPolicyEngine,
    TeachingDecisionRepository,
    TutorGenerationService,
    StructuralResponseValidator,
    DeterministicGuardService,
    SemanticGuardService,
    SafeFallbackService,
    ResponseApprovalService,
    RetrievalQueryBuilder,
    TUTOR_MODEL_PORT,
    ANALYSIS_MODEL_PORT,
    SEMANTIC_GUARD_PORT,
  ],
})
export class SocraticTutorModule {}

function stringConfigValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}
