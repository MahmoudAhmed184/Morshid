import { Injectable, Logger } from '@nestjs/common'

import {
  TutorTurnFailureCode,
  TutorTurnStatus,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { RetrievalService } from '../retrieval/retrieval.service'
import { TurnService } from '../socratic-tutor/turn.service'
import { TopicService } from '../socratic-tutor/topic.service'
import { TopicStateService } from '../socratic-tutor/topic-state.service'
import { ContextManager } from '../socratic-tutor/context-manager.service'
import { EducationalAnalysisService } from '../socratic-tutor/educational-analysis.service'
import { TeachingPolicyEngine } from '../socratic-tutor/teaching-policy.engine'
import { ResponseApprovalService } from '../socratic-tutor/response-approval.service'
import { TURN_ACQUISITION_OUTCOME } from '../socratic-tutor/turn.types'
import { TOPIC_RESOLUTION_OUTCOME } from '../socratic-tutor/topic.types'
import {
  RetrievalQueryBuilder,
  retrievalQueryContextFromAnalysis,
} from '../socratic-tutor/retrieval-query.builder'
import { chatMessageSelect } from './student-chat.repository.support'
import type {
  SocraticOrchestrationInput,
  SocraticOrchestrationResult,
} from './socratic-chat.types'

/**
 * Bridge between the student chat module and the Phase 1–5 Socratic pipeline.
 *
 * Owns the full lifecycle:
 *   TutorTurn → Topic → TopicState → EducationalAnalysis → TeachingDecision
 *   → RetrievalQueryBuilder → course-scoped Retrieval
 *   → TutorGeneration + Validation → Approval
 *
 * Returns a result that {@link GroundedChatService} maps to the existing
 * response DTO without changing the HTTP contract.
 */
@Injectable()
export class SocraticChatOrchestrator {
  private readonly logger = new Logger(SocraticChatOrchestrator.name)

  constructor(
    private readonly turnService: TurnService,
    private readonly topicService: TopicService,
    private readonly topicStateService: TopicStateService,
    private readonly contextManager: ContextManager,
    private readonly educationalAnalysisService: EducationalAnalysisService,
    private readonly teachingPolicyEngine: TeachingPolicyEngine,
    private readonly responseApprovalService: ResponseApprovalService,
    private readonly retrievalQueryBuilder: RetrievalQueryBuilder,
    private readonly retrievalService: RetrievalService,
    private readonly prismaService: PrismaService,
  ) {}

  async orchestrate(
    input: SocraticOrchestrationInput,
  ): Promise<SocraticOrchestrationResult> {
    // ── Phase 0: TutorTurn acquisition ──────────────────────────────
    const acquisition = await this.turnService.getOrCreate(
      input.sessionId,
      input.idempotencyKey,
    )

    if (acquisition.outcome === TURN_ACQUISITION_OUTCOME.COMPLETED) {
      return this.replayCompletedTurn(acquisition.turn.id)
    }
    if (acquisition.outcome === TURN_ACQUISITION_OUTCOME.ALREADY_PROCESSING) {
      return { kind: 'failed', errorCode: 'SOCRATIC_TURN_ALREADY_PROCESSING' }
    }
    if (acquisition.outcome === TURN_ACQUISITION_OUTCOME.FAILED) {
      return { kind: 'failed', errorCode: 'SOCRATIC_TURN_PREVIOUSLY_FAILED' }
    }

    const turnId = acquisition.turn.id

    try {
      return await this.runPipeline(input, turnId)
    } catch (error) {
      this.logger.warn({
        event: 'socratic_chat_orchestration_failed',
        turnId,
        error: error instanceof Error ? error.message : 'UnknownError',
      })
      await this.safeMarkTurnFailed(turnId)
      throw error
    }
  }

  /**
   * Execute the full Socratic pipeline within a structured try/catch so that
   * failures always mark the TutorTurn as FAILED before returning.
   */
  private async runPipeline(
    input: SocraticOrchestrationInput,
    turnId: string,
  ): Promise<SocraticOrchestrationResult> {
    // ── Link student message to TutorTurn ─────────────────────────
    await this.turnService.linkStudentMessage(turnId, input.studentMessageId)

    // ── Phase 1: Topic resolution ─────────────────────────────────
    const resolution = await this.topicService.resolveTopic({
      sessionId: input.sessionId,
      courseId: input.courseId,
    })
    if (
      resolution.outcome === TOPIC_RESOLUTION_OUTCOME.UNRESOLVED ||
      resolution.topicId === null
    ) {
      return this.failTurn(
        turnId,
        TutorTurnStatus.RECEIVED,
        TutorTurnFailureCode.ANALYSIS_FAILED,
        'SOCRATIC_TOPIC_UNRESOLVED',
      )
    }
    const topicId = resolution.topicId

    await this.turnService.attachResolvedTopic(
      turnId,
      input.studentMessageId,
      topicId,
    )

    // ── TopicState loading ────────────────────────────────────────
    const topicState = await this.topicStateService.getOrCreate(topicId)

    // ── Phase 2: Educational Analysis ─────────────────────────────
    await this.turnService.transitionStatus(
      turnId,
      TutorTurnStatus.RECEIVED,
      TutorTurnStatus.ANALYZING,
    )

    const analysisContext = await this.contextManager.buildAnalysisContext({
      courseId: input.courseId,
      sessionId: input.sessionId,
      studentId: input.studentId,
      studentMessageId: input.studentMessageId,
      activeTopicId: topicId,
    })
    if (analysisContext === null) {
      return this.failTurn(
        turnId,
        TutorTurnStatus.ANALYZING,
        TutorTurnFailureCode.ANALYSIS_FAILED,
        'SOCRATIC_ANALYSIS_CONTEXT_UNAVAILABLE',
      )
    }

    const analysisResult =
      await this.educationalAnalysisService.analyze(analysisContext)
    if (!analysisResult.success) {
      return this.failTurn(
        turnId,
        TutorTurnStatus.ANALYZING,
        TutorTurnFailureCode.ANALYSIS_FAILED,
        `SOCRATIC_ANALYSIS_FAILED:${analysisResult.errorCode}`,
      )
    }

    // ── Phase 3: Teaching Decision ────────────────────────────────
    await this.turnService.transitionStatus(
      turnId,
      TutorTurnStatus.ANALYZING,
      TutorTurnStatus.DECIDING,
    )

    const decisionResult = await this.teachingPolicyEngine.selectDecision({
      analysis: analysisResult.analysis,
      topicState,
    })
    if (!decisionResult.success) {
      return this.failTurn(
        turnId,
        TutorTurnStatus.DECIDING,
        TutorTurnFailureCode.GENERATION_FAILED,
        `SOCRATIC_DECISION_FAILED:${decisionResult.errorCode}`,
      )
    }

    // ── Course-scoped RAG Retrieval ───────────────────────────────
    await this.turnService.transitionStatus(
      turnId,
      TutorTurnStatus.DECIDING,
      TutorTurnStatus.RETRIEVING,
    )

    const retrievalRequest = this.retrievalQueryBuilder.build(
      retrievalQueryContextFromAnalysis(
        analysisContext,
        analysisResult.analysis,
      ),
    )
    this.logger.debug({
      event: 'socratic_retrieval_query_built',
      turnId,
      queryVersion: retrievalRequest.queryVersion,
      queryLength: retrievalRequest.query.length,
      contextualMessageCount: retrievalRequest.contextMessageIds.length,
    })
    const retrieval = await this.retrievalService.retrieveCourseEvidence(
      input.courseId,
      retrievalRequest.query,
    )
    if (retrieval.kind === 'embedding_profile_not_ready') {
      await this.markTurnFailed(
        turnId,
        TutorTurnStatus.RETRIEVING,
        TutorTurnFailureCode.RETRIEVAL_FAILED,
      )
      return { kind: 'blocked', reason: 'embedding_profile_not_ready' }
    }
    if (retrieval.kind === 'insufficient_evidence') {
      await this.markTurnFailed(
        turnId,
        TutorTurnStatus.RETRIEVING,
        TutorTurnFailureCode.RETRIEVAL_FAILED,
      )
      return { kind: 'blocked', reason: 'insufficient_evidence' }
    }

    // ── Phase 4 + 5: Generation, Validation, Approval ─────────────
    await this.turnService.transitionStatus(
      turnId,
      TutorTurnStatus.RETRIEVING,
      TutorTurnStatus.GENERATING,
    )

    const approval = await this.responseApprovalService.approveAndPersist({
      courseId: input.courseId,
      sessionId: input.sessionId,
      studentId: input.studentId,
      turnId,
      studentMessageId: input.studentMessageId,
      topicId,
      assistantMessageId: input.assistantMessageId,
      retrievalResult: retrieval.chunks,
    })
    if (!approval.success) {
      return this.failTurn(
        turnId,
        TutorTurnStatus.GENERATING,
        TutorTurnFailureCode.GENERATION_FAILED,
        `SOCRATIC_APPROVAL_FAILED:${approval.errorCode}`,
      )
    }

    // ── Reload the completed assistant message ────────────────────
    const assistantMessage = await this.prismaService.message.findUniqueOrThrow(
      {
        where: { id: input.assistantMessageId },
        select: chatMessageSelect,
      },
    )

    return { kind: 'completed', assistantMessage }
  }

  /**
   * Replay an idempotent TutorTurn that was already COMPLETED.
   * Returns the persisted approved tutor message.
   */
  private async replayCompletedTurn(
    turnId: string,
  ): Promise<SocraticOrchestrationResult> {
    const turn = await this.prismaService.tutorTurn.findUnique({
      where: { id: turnId },
      select: { approvedTutorMessageId: true },
    })
    if (turn?.approvedTutorMessageId === null || turn === null) {
      return { kind: 'failed', errorCode: 'SOCRATIC_REPLAY_INCONSISTENT' }
    }

    const assistantMessage = await this.prismaService.message.findUnique({
      where: { id: turn.approvedTutorMessageId },
      select: chatMessageSelect,
    })
    if (assistantMessage === null) {
      return { kind: 'failed', errorCode: 'SOCRATIC_REPLAY_MESSAGE_MISSING' }
    }

    return { kind: 'completed', assistantMessage }
  }

  private async failTurn(
    turnId: string,
    expectedStatus: TutorTurnStatus,
    failureCode: TutorTurnFailureCode,
    errorCode: string,
  ): Promise<SocraticOrchestrationResult> {
    await this.markTurnFailed(turnId, expectedStatus, failureCode)
    return { kind: 'failed', errorCode }
  }

  private async markTurnFailed(
    turnId: string,
    expectedStatus: TutorTurnStatus,
    failureCode: TutorTurnFailureCode,
  ): Promise<void> {
    try {
      await this.turnService.markFailed(turnId, expectedStatus, failureCode)
    } catch {
      this.logger.warn({
        event: 'socratic_chat_mark_failed_error',
        turnId,
        expectedStatus,
        failureCode,
      })
    }
  }

  /**
   * Best-effort failure marking when the current TutorTurn status is unknown.
   * Tries each non-terminal status until one succeeds or all are exhausted.
   */
  private async safeMarkTurnFailed(turnId: string): Promise<void> {
    const statuses = [
      TutorTurnStatus.RECEIVED,
      TutorTurnStatus.ANALYZING,
      TutorTurnStatus.DECIDING,
      TutorTurnStatus.RETRIEVING,
      TutorTurnStatus.GENERATING,
      TutorTurnStatus.VALIDATING,
      TutorTurnStatus.REGENERATING,
    ] as const
    for (const status of statuses) {
      try {
        await this.turnService.markFailed(
          turnId,
          status,
          TutorTurnFailureCode.PERSISTENCE_FAILED,
        )
        return
      } catch {
        // Status mismatch — try next
      }
    }
  }
}
