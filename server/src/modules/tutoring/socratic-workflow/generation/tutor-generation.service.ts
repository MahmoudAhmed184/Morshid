import { Inject, Injectable, Logger } from '@nestjs/common'

import {
  assertRequestBudget,
  RequestBudgetExceededError,
} from '../../../../common/http/request-deadline'
import {
  readUpstreamFailure,
  waitForRetry,
} from '../../../../platform/ai/upstream/upstream-retry-policy'
import { ContextManager } from '../analysis/context-manager.service'
import { EducationalAnalysisRepository } from '../analysis/educational-analysis.repository'
import { TeachingDecisionRepository } from '../teaching-decision/teaching-decision.repository'
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
import { TUTOR_GENERATION_PROMPT_VERSION } from './tutor-prompt.definition'
import { validateCandidateResponse } from './tutor-candidate.schema'
import { tutorFailureFromModelError } from '../../infrastructure/tutor-model.adapter'
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
    assertRequestBudget(input)
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
    assertRequestBudget(input)

    if (
      analysisContext.studentMessage.attemptId !== input.attemptId ||
      analysisContext.activeTopic.id !== input.topicId ||
      analysisContext.activeTopic.courseId !== input.courseId ||
      analysisContext.activeTopic.sessionId !== input.sessionId
    ) {
      return failure(TUTOR_GENERATION_FAILURE_CODE.INVALID_GENERATION_CONTEXT)
    }

    const [acceptedAnalysis, teachingDecision, previousTeachingDecision] =
      await Promise.all([
        this.educationalAnalysisRepository.findLatestAccepted({
          attemptId: input.attemptId,
          topicId: input.topicId,
          studentMessageId: input.studentMessageId,
        }),
        this.teachingDecisionRepository.findByTurnId(input.attemptId),
        this.teachingDecisionRepository.findLatestCompletedForSameTopicBeforeTurn(
          { attemptId: input.attemptId, topicId: input.topicId },
        ),
      ])
    assertRequestBudget(input)
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
      outputProtection: input.outputProtection,
      debuggingGuidance: input.debuggingGuidance,
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
      assertRequestBudget(input)
      try {
        modelResponse = await this.tutorModelPort.generate(request)
        break
      } catch (error) {
        assertRequestBudget(input)
        const errorCode = tutorFailureFromModelError(error)
        const upstreamFailure = readUpstreamFailure(error, Date.now())
        const willRetry =
          this.retryPolicy.canRetry(error, infrastructureRetryCount) &&
          upstreamFailure.retryable
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
        await waitForRetry(
          upstreamFailure.retryDelayMs,
          input.signal ?? new AbortController().signal,
          () => new RequestBudgetExceededError(),
        )
        assertRequestBudget(input)
      }
    }

    const validation = validateCandidateResponse(
      modelResponse.rawOutput,
      {
        allowedCitationIds: new Set(
          generationContext.context.allowedCitationIds,
        ),
        requireGrounding: teachingDecision.guardPolicy.requireGrounding,
        enforceCitationSupport:
          teachingDecision.guardPolicy.enforceCitationSupport,
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
      attemptId: string
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
      attemptId: input.context.attemptId,
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
