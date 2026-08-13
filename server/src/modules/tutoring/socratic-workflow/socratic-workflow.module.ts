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
} from './analysis-confidence-policy'
import { AnalysisFallbackBuilder } from './analysis-fallback-builder'
import { ANALYSIS_MODEL_PORT } from './analysis-model.port'
import { OPENAI_COMPATIBLE_ANALYSIS_MODEL_PROVIDER } from './analysis-model.configuration'
import { createAnalysisModelPort } from './analysis-model.provider'
import {
  ANALYSIS_RETRY_POLICY,
  AnalysisRetryPolicy,
} from './analysis-retry-policy'
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
import { OPENAI_COMPATIBLE_TUTOR_MODEL_PROVIDER } from './tutor-model.configuration'
import { createTutorModelPort } from './tutor-model.adapter'
import { TutorGenerationService } from './tutor-generation.service'
import {
  TUTOR_INFRASTRUCTURE_RETRY_POLICY,
  TutorInfrastructureRetryPolicy,
} from './tutor-infrastructure-retry.policy'
import { PrismaTopicRepository, TopicRepository } from './topic.repository'
import { TopicService } from './topic.service'
import { StructuralResponseValidator } from './structural-response.validator'
import { DeterministicGuardService } from './deterministic-guard.service'
import { SemanticGuardService } from './semantic-guard.service'
import { SafeFallbackService } from './safe-fallback.service'
import { ResponseApprovalService } from './response-approval.service'
import { SEMANTIC_GUARD_PORT } from './semantic-guard.types'
import { OPENAI_COMPATIBLE_SEMANTIC_GUARD_PROVIDER } from './semantic-guard.configuration'
import { createSemanticGuardPort } from './semantic-guard.adapter'
import { RetrievalQueryBuilder } from './retrieval-query.builder'
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
  exports: [
    TopicService,
    TopicStateService,
    TutoringTurnRepository,
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
    TUTORING_CONFIGURATION,
    SocraticWorkflow,
  ],
})
export class SocraticWorkflowModule {}
