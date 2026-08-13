import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { PrismaModule } from '../../../platform/database/prisma.module'
import { ConversationsModule } from '../../conversations/conversations.module'
import { AuditModule } from '../../audit/audit.module'
import { MaterialsModule } from '../../materials/materials.module'
import { ReviewsModule } from '../../reviews/reviews.module'
import {
  PrismaTutoringTurnRepository,
  TutoringTurnRepository,
} from '../attempt/tutoring-turn.repository'
import {
  ANALYSIS_CONFIDENCE_POLICY,
  AnalysisConfidencePolicy,
} from './analysis/analysis-confidence-policy'
import { AnalysisFallbackBuilder } from './analysis/analysis-fallback-builder'
import { ANALYSIS_MODEL_PORT } from './analysis/analysis-model.port'
import { OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER } from '../infrastructure/analysis-model.configuration'
import { createAnalysisModelPort } from '../infrastructure/analysis-model.provider'
import {
  ANALYSIS_RETRY_POLICY,
  AnalysisRetryPolicy,
} from './analysis/analysis-retry-policy'
import { ContextManager } from './analysis/context-manager.service'
import {
  EducationalAnalysisRepository,
  PrismaEducationalAnalysisRepository,
} from './analysis/educational-analysis.repository'
import {
  PrismaTeachingDecisionRepository,
  TeachingDecisionRepository,
} from './teaching-decision/teaching-decision.repository'
import { TeachingPolicyEngine } from './teaching-decision/teaching-policy.engine'
import { EducationalAnalysisService } from './analysis/educational-analysis.service'
import {
  PrismaTopicStateRepository,
  TopicStateRepository,
} from './topic/topic-state.repository'
import { TopicStateService } from './topic/topic-state.service'
import { TUTOR_MODEL_PORT } from './generation/tutor-generation.types'
import { OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER } from '../infrastructure/tutor-model.configuration'
import { createTutorModelPort } from '../infrastructure/tutor-model.adapter'
import { TutorGenerationService } from './generation/tutor-generation.service'
import {
  TUTOR_INFRASTRUCTURE_RETRY_POLICY,
  TutorInfrastructureRetryPolicy,
} from './generation/tutor-infrastructure-retry.policy'
import {
  PrismaTopicRepository,
  TopicRepository,
} from './topic/topic.repository'
import { TopicService } from './topic/topic.service'
import { StructuralResponseValidator } from './response-approval/structural-response.validator'
import { DeterministicGuardService } from './response-approval/deterministic-guard.service'
import { SemanticGuardService } from './response-approval/semantic-guard.service'
import { SafeFallbackService } from './response-approval/safe-fallback.service'
import { ResponseApprovalService } from './response-approval/response-approval.service'
import { SEMANTIC_GUARD_PORT } from './response-approval/semantic-guard.types'
import { OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER } from '../infrastructure/semantic-guard.configuration'
import { createSemanticGuardPort } from '../infrastructure/semantic-guard.adapter'
import { RetrievalQueryBuilder } from './evidence-query/retrieval-query.builder'
import { ResponseGovernanceModule } from '../response-governance/response-governance.module'
import { SocraticWorkflow } from './socratic-workflow'
import {
  readTutoringConfiguration,
  TUTORING_CONFIGURATION,
  type TutoringConfiguration,
} from '../tutoring.configuration'

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ConversationsModule,
    AuditModule,
    MaterialsModule,
    ReviewsModule,
    ResponseGovernanceModule,
  ],
  providers: [
    TopicStateService,
    TopicService,
    {
      provide: TutoringTurnRepository,
      useClass: PrismaTutoringTurnRepository,
    },
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
    SocraticWorkflow,
    {
      provide: TopicStateRepository,
      useClass: PrismaTopicStateRepository,
    },
    {
      provide: TopicRepository,
      useClass: PrismaTopicRepository,
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
      provide: TUTORING_CONFIGURATION,
      inject: [ConfigService],
      useFactory: readTutoringConfiguration,
    },
    {
      provide: ANALYSIS_CONFIDENCE_POLICY,
      inject: [TUTORING_CONFIGURATION],
      useFactory: (configuration: TutoringConfiguration) =>
        new AnalysisConfidencePolicy({
          threshold: configuration.ANALYSIS_CONFIDENCE_THRESHOLD,
        }),
    },
    {
      provide: ANALYSIS_RETRY_POLICY,
      inject: [TUTORING_CONFIGURATION],
      useFactory: (configuration: TutoringConfiguration) =>
        new AnalysisRetryPolicy(configuration.ANALYSIS_MODEL_MAX_RETRIES),
    },
    {
      provide: ANALYSIS_MODEL_PORT,
      inject: [TUTORING_CONFIGURATION],
      useFactory: (configuration: TutoringConfiguration) => {
        const provider = configuration.ANALYSIS_MODEL_PROVIDER
        const timeoutMs = configuration.ANALYSIS_MODEL_TIMEOUT_MS
        const maxCompletionTokens =
          configuration.ANALYSIS_MODEL_MAX_COMPLETION_TOKENS

        if (provider === OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER) {
          return createAnalysisModelPort({
            provider,
            timeoutMs,
            openAICompatible: {
              baseUrl: configuration.ANALYSIS_MODEL_BASE_URL,
              modelName: configuration.ANALYSIS_MODEL_NAME,
              apiKey: configuration.ANALYSIS_MODEL_API_KEY,
              maxCompletionTokens,
            },
          })
        }

        return createAnalysisModelPort({
          provider: 'deterministic',
          timeoutMs,
        })
      },
    },
    {
      provide: TUTOR_INFRASTRUCTURE_RETRY_POLICY,
      inject: [TUTORING_CONFIGURATION],
      useFactory: (configuration: TutoringConfiguration) =>
        new TutorInfrastructureRetryPolicy(
          configuration.TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES,
        ),
    },
    {
      provide: TUTOR_MODEL_PORT,
      inject: [TUTORING_CONFIGURATION],
      useFactory: (configuration: TutoringConfiguration) => {
        const provider = configuration.TUTOR_MODEL_PROVIDER
        const timeoutMs = configuration.TUTOR_MODEL_TIMEOUT_MS
        const maxCompletionTokens =
          configuration.TUTOR_MODEL_MAX_COMPLETION_TOKENS

        if (provider === OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER) {
          return createTutorModelPort({
            provider,
            timeoutMs,
            openAICompatible: {
              baseUrl: configuration.TUTOR_MODEL_BASE_URL,
              modelName: configuration.TUTOR_MODEL_NAME,
              apiKey: configuration.TUTOR_MODEL_API_KEY,
              maxCompletionTokens,
            },
          })
        }

        return createTutorModelPort({
          provider: 'deterministic',
          timeoutMs,
        })
      },
    },
    {
      provide: SEMANTIC_GUARD_PORT,
      inject: [TUTORING_CONFIGURATION],
      useFactory: (configuration: TutoringConfiguration) => {
        const provider = configuration.SEMANTIC_GUARD_PROVIDER
        const timeoutMs = configuration.SEMANTIC_GUARD_TIMEOUT_MS
        const maxCompletionTokens =
          configuration.SEMANTIC_GUARD_MAX_COMPLETION_TOKENS

        if (provider === OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER) {
          return createSemanticGuardPort({
            provider,
            timeoutMs,
            openAICompatible: {
              baseUrl: configuration.SEMANTIC_GUARD_BASE_URL,
              modelName: configuration.SEMANTIC_GUARD_MODEL_NAME,
              apiKey: configuration.SEMANTIC_GUARD_API_KEY,
              maxCompletionTokens,
            },
          })
        }

        return createSemanticGuardPort({
          provider: 'deterministic',
          timeoutMs,
        })
      },
    },
  ],
  exports: [TutoringTurnRepository, TUTORING_CONFIGURATION, SocraticWorkflow],
})
export class SocraticWorkflowModule {}
