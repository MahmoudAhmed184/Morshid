import { Inject, Injectable, Logger } from '@nestjs/common'

import { ContextManager } from './context-manager.service'
import { EducationalAnalysisRepository } from './educational-analysis.repository'
import { TeachingDecisionRepository } from './teaching-decision.repository'
import {
  buildGenerationContextPackage,
  citationIdForChunk,
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
import { validateCandidateResponse } from './tutor-candidate.schema'
import { tutorFailureFromModelError } from './tutor-model.adapter'

@Injectable()
export class TutorGenerationService {
  private readonly logger = new Logger(TutorGenerationService.name)

  constructor(
    private readonly contextManager: ContextManager,
    private readonly educationalAnalysisRepository: EducationalAnalysisRepository,
    private readonly teachingDecisionRepository: TeachingDecisionRepository,
    @Inject(TUTOR_MODEL_PORT)
    private readonly tutorModelPort: TutorModelPort,
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

    const [acceptedAnalysis, teachingDecision] = await Promise.all([
      this.educationalAnalysisRepository.findLatestAccepted({
        turnId: input.turnId,
        topicId: input.topicId,
        studentMessageId: input.studentMessageId,
      }),
      this.teachingDecisionRepository.findByTurnId(input.turnId),
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
      retrievedChunks: input.retrievalResult,
    })
    if (!generationContext.success) {
      return failure(TUTOR_GENERATION_FAILURE_CODE.INVALID_GENERATION_CONTEXT)
    }
    const context =
      input.regeneration === undefined
        ? generationContext.context
        : withRegenerationContext(generationContext.context, input.regeneration)

    const request = buildTutorGenerationModelRequest(context, input.signal)
    const startedAt = Date.now()
    let modelResponse: TutorModelResponse
    try {
      modelResponse = await this.tutorModelPort.generate(request)
    } catch (error) {
      const errorCode = tutorFailureFromModelError(error)
      this.logGenerationOutcome({
        context,
        status: 'failed',
        errorCode,
        latencyMs: Date.now() - startedAt,
      })
      return failure(errorCode)
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
      return failure(TUTOR_GENERATION_FAILURE_CODE[validation.errorCode])
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
    })

    return {
      success: true,
      candidate: validation.data,
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
      promptVersion: 'tutor-generation.mvp.v1',
      latencyMs: input.latencyMs,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      infrastructureRetryCount: 0,
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
): TutorGenerationServiceResult {
  return {
    success: false,
    errorCode,
  }
}
