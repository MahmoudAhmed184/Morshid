import { Inject, Injectable, Logger } from '@nestjs/common'

import { ContextManager } from './context-manager.service'
import { EducationalAnalysisRepository } from './educational-analysis.repository'
import { TeachingDecisionRepository } from './teaching-decision.repository'
import {
  buildGenerationContextPackage,
  citationIdForChunk,
  guardEducationalContextFromGenerationContext,
  regenerationMatchesTeachingDecision,
  withRegenerationContext,
} from './tutor-generation-context'
import {
  TUTOR_GENERATION_FAILURE_CODE,
  TUTOR_MODEL_PORT,
  type TutorGenerationFailureCode,
  type TutorGenerationInput,
  type TutorGenerationServiceResult,
  type TutorModelPort,
  type TutorModelResponse,
} from './tutor-generation.types'
import { buildTutorGenerationModelRequest } from './tutor-prompt.builder'
import { TUTOR_GENERATION_PROMPT_VERSION } from './tutor-prompt.registry'
import { validateCandidateResponse } from './tutor-candidate.schema'
import { tutorFailureFromModelError } from './tutor-model.adapter'
import {
  TUTOR_INFRASTRUCTURE_RETRY_POLICY,
  type TutorInfrastructureRetryPolicy,
} from './tutor-infrastructure-retry.policy'

@Injectable()
export class TutorGenerationService {
  private readonly logger = new Logger(TutorGenerationService.name)

  constructor(
    private readonly contextManager: ContextManager,
    private readonly educationalAnalysisRepository: EducationalAnalysisRepository,
    private readonly teachingDecisionRepository: TeachingDecisionRepository,
    @Inject(TUTOR_MODEL_PORT)
    private readonly tutorModelPort: TutorModelPort,
    @Inject(TUTOR_INFRASTRUCTURE_RETRY_POLICY)
    private readonly retryPolicy: TutorInfrastructureRetryPolicy,
  ) {}

  async generate(
    input: TutorGenerationInput,
  ): Promise<TutorGenerationServiceResult> {
    const analysisContext = await this.contextManager.buildAnalysisContext({
      courseId: input.courseId,
      sessionId: input.sessionId,
      studentId: input.studentId,
      studentMessageId: input.studentMessageId,
      activeTopicId: input.topicId,
    })
    if (analysisContext === null) {
      return failure(TUTOR_GENERATION_FAILURE_CODE.INVALID_GENERATION_CONTEXT)
    }

    if (
      analysisContext.studentMessage.turnId !== input.turnId ||
      analysisContext.activeTopic.id !== input.topicId ||
      analysisContext.activeTopic.courseId !== input.courseId ||
      analysisContext.activeTopic.sessionId !== input.sessionId
    ) {
      return failure(TUTOR_GENERATION_FAILURE_CODE.INVALID_GENERATION_CONTEXT)
    }

    const [acceptedAnalysis, teachingDecision, previousTeachingDecision] =
      await Promise.all([
        this.educationalAnalysisRepository.findLatestAccepted({
          turnId: input.turnId,
          topicId: input.topicId,
          studentMessageId: input.studentMessageId,
        }),
        this.teachingDecisionRepository.findByTurnId(input.turnId),
        this.teachingDecisionRepository.findLatestCompletedForSameTopicBeforeTurn(
          { turnId: input.turnId, topicId: input.topicId },
        ),
      ])
    if (teachingDecision === null) {
      return failure(TUTOR_GENERATION_FAILURE_CODE.MISSING_TEACHING_DECISION)
    }
    if (acceptedAnalysis === null) {
      return failure(TUTOR_GENERATION_FAILURE_CODE.MISSING_ACCEPTED_ANALYSIS)
    }

    if (!hasStableDenseCitationIds(input.retrievalResult)) {
      return failure(TUTOR_GENERATION_FAILURE_CODE.RETRIEVAL_SCOPE_VIOLATION)
    }

    const generationContext = buildGenerationContextPackage({
      analysisContext,
      acceptedAnalysis,
      teachingDecision,
      previousTeachingDecision,
      retrievedChunks: input.retrievalResult,
    })
    if (!generationContext.success) {
      return failure(TUTOR_GENERATION_FAILURE_CODE.INVALID_GENERATION_CONTEXT)
    }
    const context =
      input.regeneration === undefined
        ? generationContext.context
        : withRegenerationContext(generationContext.context, input.regeneration)
    if (!regenerationMatchesTeachingDecision(context)) {
      return failure(TUTOR_GENERATION_FAILURE_CODE.INVALID_GENERATION_CONTEXT)
    }

    const request = buildTutorGenerationModelRequest(context, input.signal)
    const startedAt = Date.now()
    let infrastructureRetryCount = 0
    let modelResponse: TutorModelResponse
    for (;;) {
      try {
        modelResponse = await this.tutorModelPort.generate(request)
        break
      } catch (error) {
        const errorCode = tutorFailureFromModelError(error)
        const willRetry = this.retryPolicy.canRetry(
          error,
          infrastructureRetryCount,
        )
        this.logGenerationOutcome({
          context,
          status: 'failed',
          errorCode,
          latencyMs: Date.now() - startedAt,
          infrastructureRetryCount,
          willRetry,
        })
        if (!willRetry) {
          return failure(errorCode, infrastructureRetryCount)
        }
        infrastructureRetryCount += 1
      }
    }

    const validation = validateCandidateResponse(
      modelResponse.rawOutput,
      {
        allowedCitationIds: new Set(
          generationContext.context.allowedCitationIds,
        ),
        requireStudentAction: teachingDecision.requireStudentAction,
        reflectionMode: teachingDecision.reflectionMode,
      },
      {
        provider: modelResponse.provider,
        model: modelResponse.model,
        tokenUsage: {
          input: modelResponse.inputTokens ?? 0,
          output: modelResponse.outputTokens ?? 0,
        },
      },
    )
    if (!validation.success) {
      return failure(
        TUTOR_GENERATION_FAILURE_CODE[validation.errorCode],
        infrastructureRetryCount,
      )
    }

    this.logGenerationOutcome({
      context,
      status: 'created',
      provider: validation.data.provider,
      model: validation.data.model,
      latencyMs: modelResponse.latencyMs ?? Date.now() - startedAt,
      inputTokens: validation.data.tokenUsage.input,
      outputTokens: validation.data.tokenUsage.output,
      usedCitationCount: validation.data.usedCitationIds.length,
      infrastructureRetryCount,
    })

    return {
      success: true,
      candidate: validation.data,
      educationalContext: guardEducationalContextFromGenerationContext(context),
      infrastructureRetryCount,
    }
  }

  private logGenerationOutcome(input: {
    context: {
      turnId: string
      sessionId: string
      topicId: string
      acceptedAnalysis: { id: string }
      teachingDecision: { id: string }
    }
    status: 'created' | 'failed'
    provider?: string
    model?: string
    errorCode?: string
    latencyMs: number
    inputTokens?: number
    outputTokens?: number
    usedCitationCount?: number
    infrastructureRetryCount: number
    willRetry?: boolean
  }): void {
    this.logger.log({
      stage: 'tutor_generation',
      turnId: input.context.turnId,
      sessionId: input.context.sessionId,
      topicId: input.context.topicId,
      analysisId: input.context.acceptedAnalysis.id,
      teachingDecisionId: input.context.teachingDecision.id,
      status: input.status,
      providerRole: 'tutor',
      provider: input.provider,
      model: input.model,
      promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
      latencyMs: input.latencyMs,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      infrastructureRetryCount: input.infrastructureRetryCount,
      willRetry: input.willRetry,
      errorCategory: input.errorCode,
      usedCitationCount: input.usedCitationCount,
    })
  }
}

function hasStableDenseCitationIds(
  chunks: readonly { readonly rank: number }[],
): boolean {
  return chunks.every(
    (chunk, index) =>
      chunk.rank === index + 1 && citationIdForChunk(chunk) !== '',
  )
}

function failure(
  errorCode: TutorGenerationFailureCode,
  infrastructureRetryCount = 0,
): TutorGenerationServiceResult {
  return {
    success: false,
    errorCode,
    infrastructureRetryCount,
  }
}
