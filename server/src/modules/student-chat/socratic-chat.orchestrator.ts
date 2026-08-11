import { Injectable, Logger } from '@nestjs/common'

import { assertRequestBudget } from '../../common/http/request-deadline'
import {
  TutoringAttemptFailureCode,
  TutoringAttemptStatus,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { RetrievalService } from '../retrieval/retrieval.service'
import { TurnService } from '../socratic-tutor/turn.service'
import { TopicService } from '../socratic-tutor/topic.service'
import { TopicStateService } from '../socratic-tutor/topic-state.service'
import { ContextManager } from '../socratic-tutor/context-manager.service'
import { classifiedResponseFor } from '../socratic-tutor/classified-response'
import { buildClassifiedTopicStateTransition } from '../socratic-tutor/topic-state-transition'
import { EducationalAnalysisService } from '../socratic-tutor/educational-analysis.service'
import { TeachingPolicyEngine } from '../socratic-tutor/teaching-policy.engine'
import {
  PersistedResponseApprovalResult,
  ResponseApprovalService,
} from '../socratic-tutor/response-approval.service'
import { TURN_ACQUISITION_OUTCOME } from '../socratic-tutor/turn.types'
import { TOPIC_RESOLUTION_OUTCOME } from '../socratic-tutor/topic.types'
import {
  RetrievalQueryBuilder,
  retrievalQueryContextFromAnalysis,
} from '../socratic-tutor/retrieval-query.builder'
import { AutomaticSafetyRiskDetector } from '../output-policy/automatic-safety-risk.detector'
import { ControlledSourceConflictDetector } from '../output-policy/controlled-source-conflict.detector'
import { chatMessageSelect } from './student-chat.repository.support'
import type {
  SocraticOrchestrationInput,
  SocraticOrchestrationResult,
} from './socratic-chat.types'

/**
 * Bridge between the student chat module and the Phase 1–5 Socratic pipeline.
 *
 * Owns the full lifecycle:
 *   TutoringAttempt → Topic → TopicState → EducationalAnalysis → TeachingDecision
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
    private readonly safetyRiskDetector: AutomaticSafetyRiskDetector,
    private readonly conflictDetector: ControlledSourceConflictDetector,
  ) {}

  async orchestrate(
    input: SocraticOrchestrationInput,
  ): Promise<SocraticOrchestrationResult> {
    assertRequestBudget(input.requestBudget)
    // ── Phase 0: TutoringAttempt acquisition ──────────────────────────────
    const acquisition = await this.turnService.getOrCreate(
      input.sessionId,
      input.clientMessageId,
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

    const attemptId = acquisition.turn.id
    assertRequestBudget(input.requestBudget)

    const inputRisk = this.safetyRiskDetector.detectStudentInput(
      input.studentMessageContent,
    )
    const hasInputRisk =
      inputRisk?.risks.some(
        (risk) =>
          risk === 'HIDDEN_PROMPT_DISCLOSURE' ||
          risk === 'FINAL_ANSWER_DELIVERY',
      ) ?? false

    if (hasInputRisk && inputRisk !== null) {
      await this.markTurnFailed(
        attemptId,
        TutoringAttemptStatus.RECEIVED,
        TutoringAttemptFailureCode.GENERATION_FAILED,
      )
      return { kind: 'safety_refusal', detection: inputRisk }
    }

    try {
      return await this.runPipeline(input, attemptId)
    } catch (error) {
      this.logger.warn({
        event: 'socratic_chat_orchestration_failed',
        attemptId,
        error: error instanceof Error ? error.message : 'UnknownError',
      })
      await this.safeMarkTurnFailed(attemptId)
      throw error
    }
  }

  /**
   * Execute the full Socratic pipeline within a structured try/catch so that
   * failures always mark the TutoringAttempt as FAILED before returning.
   */
  private async runPipeline(
    input: SocraticOrchestrationInput,
    attemptId: string,
  ): Promise<SocraticOrchestrationResult> {
    assertRequestBudget(input.requestBudget)
    // ── Link student message to TutoringAttempt ─────────────────────────
    await this.turnService.linkStudentMessage(attemptId, input.studentMessageId)

    // ── Phase 1: Topic resolution ─────────────────────────────────
    const resolution = await this.topicService.resolveTopic({
      sessionId: input.sessionId,
      courseId: input.courseId,
      topicId: input.topicSelection?.topicId,
      problemId: input.topicSelection?.problemId,
      conceptId: input.topicSelection?.conceptId,
      title: input.topicSelection?.title,
    })
    if (
      resolution.outcome === TOPIC_RESOLUTION_OUTCOME.UNRESOLVED ||
      resolution.topicId === null
    ) {
      return this.failTurn(
        attemptId,
        TutoringAttemptStatus.RECEIVED,
        TutoringAttemptFailureCode.ANALYSIS_FAILED,
        'SOCRATIC_TOPIC_UNRESOLVED',
      )
    }
    const topicId = resolution.topicId

    await this.turnService.attachResolvedTopic(
      attemptId,
      input.studentMessageId,
      topicId,
    )
    await this.prismaService.message.updateMany({
      where: { id: { in: [input.studentMessageId, input.assistantMessageId] } },
      data: { attemptId, topicId },
    })

    // ── TopicState loading ────────────────────────────────────────
    const topicState = await this.topicStateService.getOrCreate(topicId)
    assertRequestBudget(input.requestBudget)

    // ── Phase 2: Educational Analysis ─────────────────────────────
    await this.turnService.transitionStatus(
      attemptId,
      TutoringAttemptStatus.RECEIVED,
      TutoringAttemptStatus.ANALYZING,
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
        attemptId,
        TutoringAttemptStatus.ANALYZING,
        TutoringAttemptFailureCode.ANALYSIS_FAILED,
        'SOCRATIC_ANALYSIS_CONTEXT_UNAVAILABLE',
      )
    }

    const analysisResult =
      input.requestBudget === undefined
        ? await this.educationalAnalysisService.analyze(analysisContext)
        : await this.educationalAnalysisService.analyze(analysisContext, {
            signal: input.requestBudget.signal,
            deadlineAt: input.requestBudget.deadlineAt,
          })
    if (!analysisResult.success) {
      return this.failTurn(
        attemptId,
        TutoringAttemptStatus.ANALYZING,
        TutoringAttemptFailureCode.ANALYSIS_FAILED,
        `SOCRATIC_ANALYSIS_FAILED:${analysisResult.errorCode}`,
      )
    }

    assertRequestBudget(input.requestBudget)

    const classifiedResponse = classifiedResponseFor(
      analysisResult.analysis.result.requestKind,
    )
    if (classifiedResponse !== null) {
      const completion = await this.turnService.completeClassifiedResponse({
        courseId: input.courseId,
        sessionId: input.sessionId,
        studentId: input.studentId,
        attemptId,
        topicId,
        studentMessageId: input.studentMessageId,
        assistantMessageId: input.assistantMessageId,
        requestKind: classifiedResponse.requestKind,
        content: classifiedResponse.content,
        guidanceLabel: classifiedResponse.guidanceLabel,
        errorCode: classifiedResponse.errorCode,
        expectedTurnStatus: TutoringAttemptStatus.ANALYZING,
        topicStateTransition: buildClassifiedTopicStateTransition({
          topicState,
          requestKind: classifiedResponse.requestKind,
        }),
      })
      if (completion.kind !== 'ok') {
        return this.failTurn(
          attemptId,
          TutoringAttemptStatus.ANALYZING,
          TutoringAttemptFailureCode.PERSISTENCE_FAILED,
          `SOCRATIC_CLASSIFIED_RESPONSE_FAILED:${completion.kind}`,
        )
      }

      const [studentMessage, assistantMessage] = await Promise.all([
        this.prismaService.message.findUniqueOrThrow({
          where: { id: input.studentMessageId },
          select: chatMessageSelect,
        }),
        this.prismaService.message.findUniqueOrThrow({
          where: { id: input.assistantMessageId },
          select: chatMessageSelect,
        }),
      ])

      return { kind: 'completed', studentMessage, assistantMessage }
    }

    // ── Phase 3: Teaching Decision ────────────────────────────────
    await this.turnService.transitionStatus(
      attemptId,
      TutoringAttemptStatus.ANALYZING,
      TutoringAttemptStatus.DECIDING,
    )

    const previousTeachingDecision =
      await this.teachingPolicyEngine.findPreviousDecision({
        attemptId,
        topicId,
      })

    const decisionResult = await this.teachingPolicyEngine.selectDecision({
      analysis: analysisResult.analysis,
      topicState,
      previousTeachingDecision,
      topicResolutionOutcome: resolution.outcome,
      previousTopicId: resolution.previousTopicId,
    })
    if (!decisionResult.success) {
      console.log('decisionResult failed:', decisionResult)
      return this.failTurn(
        attemptId,
        TutoringAttemptStatus.DECIDING,
        TutoringAttemptFailureCode.GENERATION_FAILED,
        `SOCRATIC_DECISION_FAILED:${decisionResult.errorCode}`,
      )
    }

    assertRequestBudget(input.requestBudget)

    // ── Course-scoped RAG Retrieval ───────────────────────────────
    await this.turnService.transitionStatus(
      attemptId,
      TutoringAttemptStatus.DECIDING,
      TutoringAttemptStatus.RETRIEVING,
    )

    const retrievalRequest = this.retrievalQueryBuilder.build(
      retrievalQueryContextFromAnalysis(
        analysisContext,
        analysisResult.analysis,
      ),
    )
    this.logger.debug({
      event: 'socratic_retrieval_query_built',
      attemptId,
      queryVersion: retrievalRequest.queryVersion,
      queryLength: retrievalRequest.query.length,
      contextualMessageCount: retrievalRequest.contextMessageIds.length,
    })
    const retrieval =
      input.requestBudget === undefined
        ? await this.retrievalService.retrieveCourseEvidence(
            input.courseId,
            retrievalRequest.query,
          )
        : await this.retrievalService.retrieveCourseEvidence(
            input.courseId,
            retrievalRequest.query,
            input.requestBudget,
          )

    assertRequestBudget(input.requestBudget)

    if (
      retrieval.kind === 'embedding_profile_not_ready' ||
      retrieval.kind === 'insufficient_evidence' ||
      retrieval.chunks.length === 0
    ) {
      const reason =
        retrieval.kind === 'embedding_profile_not_ready'
          ? 'embedding_profile_not_ready'
          : 'insufficient_evidence'
      return { kind: 'blocked', reason }
    }

    const documentRisk = this.safetyRiskDetector.detectRetrievedDocuments(
      retrieval.chunks,
    )
    if (documentRisk !== null) {
      await this.markTurnFailed(
        attemptId,
        TutoringAttemptStatus.RETRIEVING,
        TutoringAttemptFailureCode.RETRIEVAL_FAILED,
      )
      return { kind: 'safety_refusal', detection: documentRisk }
    }

    const conflict = this.conflictDetector.detect(
      input.studentMessageContent,
      retrieval.chunks,
    )
    if (conflict !== null) {
      await this.markTurnFailed(
        attemptId,
        TutoringAttemptStatus.RETRIEVING,
        TutoringAttemptFailureCode.RETRIEVAL_FAILED,
      )
      return { kind: 'source_conflict', conflict }
    }

    // ── Phase 4 + 5: Generation, Validation, Approval ─────────────
    await this.turnService.transitionStatus(
      attemptId,
      TutoringAttemptStatus.RETRIEVING,
      TutoringAttemptStatus.GENERATING,
    )

    assertRequestBudget(input.requestBudget)
    const approval: PersistedResponseApprovalResult =
      await this.responseApprovalService.approveAndPersist({
        courseId: input.courseId,
        sessionId: input.sessionId,
        studentId: input.studentId,
        attemptId,
        studentMessageId: input.studentMessageId,
        topicId,
        assistantMessageId: input.assistantMessageId,
        retrievalResult: retrieval.chunks,
        topicState,
        analysis: analysisResult.analysis,
        ...(input.requestBudget === undefined
          ? {}
          : {
              signal: input.requestBudget.signal,
              deadlineAt: input.requestBudget.deadlineAt,
            }),
      })
    if (!approval.success) {
      if ('outputRisk' in approval && approval.outputRisk !== undefined) {
        await this.markTurnFailed(
          attemptId,
          TutoringAttemptStatus.GENERATING,
          TutoringAttemptFailureCode.GENERATION_FAILED,
        )
        return { kind: 'safety_refusal', detection: approval.outputRisk }
      }
      const turnStatus =
        'turnStatus' in approval
          ? approval.turnStatus
          : TutoringAttemptStatus.GENERATING
      return this.failTurn(
        attemptId,
        turnStatus,
        TutoringAttemptFailureCode.GENERATION_FAILED,
        `SOCRATIC_APPROVAL_FAILED:${approval.errorCode}`,
      )
    }

    const outputRisk = this.safetyRiskDetector.detectOutput(
      approval.approvedResponse.message,
      true,
    )
    if (outputRisk !== null) {
      await this.markTurnFailed(
        attemptId,
        TutoringAttemptStatus.GENERATING,
        TutoringAttemptFailureCode.GENERATION_FAILED,
      )
      return { kind: 'safety_refusal', detection: outputRisk }
    }

    // Reload both records so the response exposes the authoritative request
    // kind reconciled by Educational Analysis as well as approved metadata.
    const [studentMessage, assistantMessage] = await Promise.all([
      this.prismaService.message.findUniqueOrThrow({
        where: { id: input.studentMessageId },
        select: chatMessageSelect,
      }),
      this.prismaService.message.findUniqueOrThrow({
        where: { id: input.assistantMessageId },
        select: chatMessageSelect,
      }),
    ])

    return { kind: 'completed', studentMessage, assistantMessage }
  }

  /**
   * Replay an idempotent TutoringAttempt that was already COMPLETED.
   * Returns the persisted approved tutor message.
   */
  private async replayCompletedTurn(
    attemptId: string,
  ): Promise<SocraticOrchestrationResult> {
    const turn = await this.prismaService.tutoringAttempt.findUnique({
      where: { id: attemptId },
      select: { assistantMessageId: true, studentMessageId: true },
    })
    if (
      turn?.assistantMessageId === null ||
      turn?.assistantMessageId === undefined ||
      turn.studentMessageId === null
    ) {
      return { kind: 'failed', errorCode: 'SOCRATIC_REPLAY_INCONSISTENT' }
    }

    const [studentMessage, assistantMessage] = await Promise.all([
      this.prismaService.message.findUnique({
        where: { id: turn.studentMessageId },
        select: chatMessageSelect,
      }),
      this.prismaService.message.findUnique({
        where: { id: turn.assistantMessageId },
        select: chatMessageSelect,
      }),
    ])
    if (studentMessage === null || assistantMessage === null) {
      return { kind: 'failed', errorCode: 'SOCRATIC_REPLAY_MESSAGE_MISSING' }
    }

    return { kind: 'completed', studentMessage, assistantMessage }
  }

  private async failTurn(
    attemptId: string,
    expectedStatus: TutoringAttemptStatus,
    failureCode: TutoringAttemptFailureCode,
    errorCode: string,
  ): Promise<SocraticOrchestrationResult> {
    await this.markTurnFailed(attemptId, expectedStatus, failureCode)
    return { kind: 'failed', errorCode }
  }

  private async markTurnFailed(
    attemptId: string,
    expectedStatus: TutoringAttemptStatus,
    failureCode: TutoringAttemptFailureCode,
  ): Promise<void> {
    try {
      await this.turnService.markFailed(attemptId, expectedStatus, failureCode)
    } catch {
      this.logger.warn({
        event: 'socratic_chat_mark_failed_error',
        attemptId,
        expectedStatus,
        failureCode,
      })
    }
  }

  /**
   * Best-effort failure marking when the current TutoringAttempt status is unknown.
   * Tries each non-terminal status until one succeeds or all are exhausted.
   */
  private async safeMarkTurnFailed(attemptId: string): Promise<void> {
    const statuses = [
      TutoringAttemptStatus.RECEIVED,
      TutoringAttemptStatus.ANALYZING,
      TutoringAttemptStatus.DECIDING,
      TutoringAttemptStatus.RETRIEVING,
      TutoringAttemptStatus.GENERATING,
      TutoringAttemptStatus.VALIDATING,
      TutoringAttemptStatus.REGENERATING,
    ] as const
    for (const status of statuses) {
      try {
        await this.turnService.markFailed(
          attemptId,
          status,
          TutoringAttemptFailureCode.PERSISTENCE_FAILED,
        )
        return
      } catch {
        // Status mismatch — try next
      }
    }
  }
}
