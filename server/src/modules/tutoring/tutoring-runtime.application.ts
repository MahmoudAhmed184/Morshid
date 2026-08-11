import { createHash, randomUUID } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'

import {
  MessageGuidanceLabel,
  MessageRequestKind,
  TutoringApprovalSource,
} from './tutoring-values'
import { isPrismaKnownRequestError } from '../../platform/database/prisma-errors'
import { TutoringRuntime } from './interface/tutoring-runtime'
import type { RunTutoringTurnCommand } from './interface/run-tutoring-turn-command'
import type { TutoringTurnReceipt } from './interface/tutoring-turn-receipt'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
  AuditService,
  type AuditRequestContext,
} from '../audit/audit.public'
import { ConversationMessageReader } from '../conversations/conversation-message-reader'
import {
  AutomaticSafetyRiskDetector,
  AUTOMATIC_SAFETY_RISK_DETECTOR_VERSION,
  type AutomaticSafetyRiskDetection,
} from './response-governance/automatic-safety-risk.detector'
import {
  selectTutorStrategy,
  type TutorStrategySelection,
} from './socratic-workflow/tutor-strategy'
import { DEBUGGING_GUIDANCE_BOUNDARY_ERROR_CODES } from './socratic-workflow/debugging-guidance/debugging-guidance.boundary-response'
import {
  ControlledSourceConflictDetector,
  CONTROLLED_SOURCE_CONFLICT_DETECTOR_VERSION,
  type ControlledSourceConflict,
} from './response-governance/controlled-source-conflict.detector'
import {
  decodeAutomaticPolicyReasons,
  RESPONSE_GOVERNANCE_VERSION,
  encodeAutomaticPolicyReasons,
  type AutomaticPolicyReason,
  type ResponseGovernanceDecision,
  type ResponseGovernanceEvidenceSource,
  type ResponseGovernanceReviewFact,
} from './response-governance/response-governance.contract'
import { ResponseGovernance } from './response-governance/response-governance'
import type { AutomaticReviewIntakeInput } from '../reviews/reviews.public'
import {
  type BeginTutoringTurnResult,
  type FinalizeTutoringTurnResult,
  TutoringTurnRepository,
  type RetryTutoringTurnResult,
} from './attempt/tutoring-turn.repository'
import { SocraticWorkflow } from './socratic-workflow/socratic-workflow'
import {
  tutoringActiveStudentMembershipRequiredException,
  tutoringRetryNotAllowedException,
  tutoringRetryTargetNotFoundException,
  tutoringSessionNotFoundException,
  tutoringTerminalStateUnavailableException,
  tutoringTurnInProgressException,
} from './interface/tutoring-errors'
import { ConversationMessagePresenter } from '../conversations/conversation-message.presenter'
import type { ChatMessageRecord } from '../conversations/conversation-records'
import {
  GROUNDING_BLOCKED_CONTENT,
  GROUNDING_INSUFFICIENT_EVIDENCE,
  GROUNDING_FAILED_CONTENT,
  GROUNDING_RESPONSE_FAILED,
} from './attempt/tutoring.constants'
import { CorrectnessSensitiveRequestClassifier } from './response-governance/correctness-sensitive-request.classifier'
import type {
  SocraticTopicSelection,
  SocraticWorkflowResult,
} from './socratic-workflow/socratic-workflow.types'
import { citationIdForChunk } from './socratic-workflow/tutor-generation-context'
import {
  assertRequestBudget,
  type RequestBudget,
} from '../../common/http/request-deadline'

export {
  GROUNDING_BLOCKED_CONTENT,
  GROUNDING_FAILED_CONTENT,
} from './attempt/tutoring.constants'

interface ActiveTutoringTurn {
  courseId: string
  attemptId: string
  studentMessage: ChatMessageRecord
  assistantMessage: ChatMessageRecord
}

interface TutoringTurnDenialInput {
  courseId: string
  sessionId: string
  studentId: string
  reason:
    | 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED'
    | 'DELETED_OR_UNOWNED'
    | 'RETRY_TARGET_NOT_FOUND'
    | 'TURN_IN_PROGRESS'
    | 'RETRY_NOT_ALLOWED'
  messageId?: string
  requestContext?: AuditRequestContext
}

interface OrchestrationContext {
  operationId: string
  courseId: string
  sessionId: string
  studentId: string
  studentMessageId?: string
  assistantMessageId?: string
}

type OrchestrationPhase =
  | 'begin'
  | 'retry'
  | 'retrieval'
  | 'model_generation'
  | 'policy_evaluation'
  | 'finalization'
  | 'unsupported_persistence'
  | 'safety_refusal_persistence'
  | 'conflict_persistence'
  | 'socratic_orchestration'
  | 'blocked_persistence'
  | 'failed_persistence'

type TerminalPersistence =
  | {
      kind: 'blocked'
      phase: 'blocked_persistence'
      content: string
      errorCode: string
      topicId?: string | null
      guidanceLabel?: MessageGuidanceLabel
    }
  | {
      kind: 'failed'
      phase: 'failed_persistence'
      content: string
      errorCode: string
      topicId?: string | null
      guidanceLabel?: MessageGuidanceLabel
    }

@Injectable()
export class TutoringRuntimeApplication extends TutoringRuntime {
  private readonly logger = new Logger(TutoringRuntimeApplication.name)

  constructor(
    private readonly turnRepository: TutoringTurnRepository,
    private readonly messagePresenter: ConversationMessagePresenter,
    private readonly socraticWorkflow: SocraticWorkflow,
    private readonly conversationMessageReader: ConversationMessageReader,
    private readonly safetyRiskDetector: AutomaticSafetyRiskDetector,
    private readonly conflictDetector: ControlledSourceConflictDetector,
    private readonly responseGovernance: ResponseGovernance,
    private readonly requestClassifier: CorrectnessSensitiveRequestClassifier,
    private readonly auditService: AuditService,
  ) {
    super()
  }

  run(command: RunTutoringTurnCommand): Promise<TutoringTurnReceipt> {
    if (command.kind === 'new') {
      return this.runNewTurn(command)
    }

    return this.runRetry(command)
  }

  private async runNewTurn(
    command: Extract<RunTutoringTurnCommand, { kind: 'new' }>,
  ): Promise<TutoringTurnReceipt> {
    const {
      courseId,
      sessionId,
      studentId,
      content,
      clientMessageId,
      problemId,
      conceptId,
      title,
      requestContext,
      requestBudget,
    } = command
    assertRequestBudget(requestBudget)
    const selection = selectTutorStrategy(content)
    const operation: OrchestrationContext = {
      operationId: randomUUID(),
      courseId,
      sessionId,
      studentId,
    }
    const classification = this.requestClassifier.classify(content)
    let result: BeginTutoringTurnResult
    try {
      result = await this.turnRepository.beginTurn({
        courseId,
        sessionId,
        studentId,
        ...(clientMessageId === undefined ? {} : { clientMessageId }),
        content,
        requestKind:
          selection.decision.requestKind === MessageRequestKind.CODE_DIAGNOSIS
            ? selection.decision.requestKind
            : classification.requestKind,
      })
    } catch (error) {
      this.logFailure('begin', operation, error)
      throw tutoringTerminalStateUnavailableException()
    }
    if (result.kind === 'replayed') {
      return this.presentReplayedTurn(
        result.studentMessage,
        result.assistantMessage,
        operation,
      )
    }
    if (result.kind !== 'ok') {
      return this.handleBeginDenial(
        result,
        courseId,
        sessionId,
        studentId,
        requestContext,
      )
    }

    return this.orchestrate(
      result,
      {
        ...operation,
        studentMessageId: result.studentMessage.id,
        assistantMessageId: result.assistantMessage.id,
      },
      requestContext,
      selection,
      {
        problemId,
        conceptId,
        title,
      },
      requestBudget,
    )
  }

  private async runRetry(
    command: Extract<RunTutoringTurnCommand, { kind: 'retry' }>,
  ): Promise<TutoringTurnReceipt> {
    const {
      courseId,
      sessionId,
      studentId,
      studentMessageId,
      requestContext,
      requestBudget,
    } = command
    assertRequestBudget(requestBudget)
    const operation: OrchestrationContext = {
      operationId: randomUUID(),
      courseId,
      sessionId,
      studentId,
      studentMessageId,
    }
    let result: RetryTutoringTurnResult
    try {
      result = await this.turnRepository.retryTurn({
        courseId,
        sessionId,
        studentId,
        studentMessageId,
      })
    } catch (error) {
      this.logFailure('retry', operation, error)
      throw tutoringTerminalStateUnavailableException()
    }
    if (result.kind !== 'ok') {
      return this.handleRetryDenial(
        result,
        courseId,
        sessionId,
        studentId,
        studentMessageId,
        requestContext,
      )
    }

    return this.orchestrate(
      result,
      {
        ...operation,
        assistantMessageId: result.assistantMessage.id,
      },
      requestContext,
      undefined,
      {
        topicId: result.studentMessage.topicId,
      },
      requestBudget,
    )
  }

  private async orchestrate(
    turn: ActiveTutoringTurn,
    operation: OrchestrationContext,
    requestContext?: AuditRequestContext,
    preparedSelection?: TutorStrategySelection,
    topicSelection?: SocraticTopicSelection,
    requestBudget?: RequestBudget,
  ): Promise<TutoringTurnReceipt> {
    assertRequestBudget(requestBudget)
    const classification = this.requestClassifier.classify(
      turn.studentMessage.content,
    )
    const inputRisk = this.safetyRiskDetector.detectStudentInput(
      turn.studentMessage.content,
    )
    if (inputRisk !== null) {
      return this.persistSafetyRefusal(
        turn,
        inputRisk,
        operation,
        requestContext,
        turn.studentMessage.topicId,
      )
    }

    const selection =
      preparedSelection ?? selectTutorStrategy(turn.studentMessage.content)
    const shouldContinueThroughSafetyPipeline =
      classification.correctnessSensitive &&
      selection.boundaryResponse?.errorCode ===
        DEBUGGING_GUIDANCE_BOUNDARY_ERROR_CODES.INSUFFICIENT_INFORMATION
    if (
      selection.boundaryResponse !== null &&
      !shouldContinueThroughSafetyPipeline
    ) {
      return this.persistTerminal(turn, operation, {
        kind: 'blocked',
        phase: 'blocked_persistence',
        content: selection.boundaryResponse.content,
        errorCode: selection.boundaryResponse.errorCode,
        topicId: turn.studentMessage.topicId,
        guidanceLabel: selection.boundaryResponse.guidanceLabel,
      })
    }

    let orchestratorResult
    try {
      orchestratorResult = await this.socraticWorkflow.run({
        courseId: turn.courseId,
        sessionId: operation.sessionId,
        studentId: operation.studentId,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        studentMessageContent: turn.studentMessage.content,
        ...(selection.diagnosis === null
          ? {}
          : {
              debuggingGuidance: {
                likelyIssue: selection.diagnosis.likelyDefect,
                relevantLocation: selection.diagnosis.location,
                concept: selection.diagnosis.conceptExplanation,
                nextInspectionStep: selection.diagnosis.nextInspectionStep,
                evidenceQuery: selection.retrievalQuery,
                rewriteRequested: selection.fullRewriteRequested,
              },
            }),
        topicSelection,
        requestBudget,
      })
    } catch (error) {
      this.logFailure('socratic_orchestration', operation, error)
      return this.persistFailure(turn, operation)
    }

    switch (orchestratorResult.kind) {
      case 'completed':
        return this.persistCompletedTurn(
          turn,
          operation,
          orchestratorResult.completion,
        )
      case 'safety_refusal':
        return this.persistSafetyRefusal(
          turn,
          orchestratorResult.detection,
          operation,
          requestContext,
          orchestratorResult.topicId,
        )
      case 'source_conflict':
        return this.persistControlledConflict(
          turn,
          orchestratorResult.conflict,
          operation,
          requestContext,
          orchestratorResult.topicId,
        )
      case 'blocked':
        return this.persistInsufficientEvidence(
          turn,
          classification.correctnessSensitive,
          operation,
          requestContext,
          orchestratorResult.topicId,
        )
      case 'failed':
        return this.persistFailure(turn, operation, orchestratorResult.topicId)
    }
  }

  private async persistCompletedTurn(
    turn: ActiveTutoringTurn,
    operation: OrchestrationContext,
    completion: Extract<
      SocraticWorkflowResult,
      { kind: 'completed' }
    >['completion'],
  ): Promise<TutoringTurnReceipt> {
    let completed: FinalizeTutoringTurnResult
    try {
      if (completion.kind === 'classified') {
        completed = await this.turnRepository.completePolicyTurn({
          courseId: turn.courseId,
          sessionId: operation.sessionId,
          studentId: operation.studentId,
          attemptId: turn.attemptId,
          studentMessageId: turn.studentMessage.id,
          assistantMessageId: turn.assistantMessage.id,
          content: completion.content,
          evidence: [],
          topicId: completion.topicId,
          topicStateTransition: completion.topicStateTransition,
          requestKind: completion.requestKind,
          guidanceLabel: completion.guidanceLabel,
          errorCode: completion.errorCode,
          promptVersion: completion.promptVersion,
          approvalSource: TutoringApprovalSource.CLASSIFIED_RESPONSE,
        })
      } else {
        const evidence = completion.evidence.map((chunk) => ({
          chunkId: chunk.chunkId,
          materialId: chunk.materialId,
          materialTitle: chunk.materialTitle,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          rank: chunk.rank,
          similarityScore: chunk.similarityScore,
        }))
        completed = await this.turnRepository.completeTurn({
          courseId: turn.courseId,
          sessionId: operation.sessionId,
          studentId: operation.studentId,
          attemptId: turn.attemptId,
          studentMessageId: turn.studentMessage.id,
          assistantMessageId: turn.assistantMessage.id,
          content: completion.approvedResponse.message,
          provider: completion.approvedResponse.approvalMetadata.provider,
          model: completion.approvedResponse.approvalMetadata.model,
          promptVersion:
            completion.approvedResponse.approvalMetadata.promptVersion,
          inputTokens: completion.approvedResponse.approvalMetadata.inputTokens,
          outputTokens:
            completion.approvedResponse.approvalMetadata.outputTokens,
          requestKind: completion.requestKind,
          evidence,
          citationContextIndexes: completion.approvedResponse.usedCitationIds
            .map((citationId) =>
              completion.evidence.findIndex(
                (chunk) => citationIdForChunk(chunk) === citationId,
              ),
            )
            .filter((index) => index >= 0)
            .map((index) => index + 1),
          topicId: completion.topicId,
          topicStateTransition: completion.topicStateTransition,
          auditGraph: completion.auditGraph,
          hintLevel: completion.guidanceLevel,
          approvalSource:
            completion.approvedResponse.source === 'SAFE_FALLBACK'
              ? TutoringApprovalSource.SAFE_FALLBACK
              : TutoringApprovalSource.VALIDATED_CANDIDATE,
          approvedCandidateAttempt:
            completion.approvedResponse.approvedCandidateAttempt,
          safeFallbackUsed: completion.approvedResponse.safeFallbackUsed,
          safeFallbackReason: completion.safeFallbackReason ?? null,
          validationPolicyVersion:
            completion.approvedResponse.approvalMetadata
              .validationPolicyVersion,
          guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
          automaticReview: undefined,
        })
      }
    } catch (error) {
      this.logFailure('finalization', operation, error)
      return this.persistFailure(turn, operation, completion.topicId)
    }

    switch (completed.kind) {
      case 'ok':
        return this.presentTurn(
          await this.reloadStudentMessage(turn.studentMessage),
          completed.message,
        )
      case 'membership_missing':
      case 'session_not_found':
      case 'message_not_found':
      case 'message_not_pending':
        this.logResultFailure('finalization', operation, completed.kind)
        return this.persistFailure(turn, operation, completion.topicId)
      default:
        return assertNever(completed)
    }
  }

  private async persistInsufficientEvidence(
    turn: ActiveTutoringTurn,
    correctnessSensitive: boolean,
    operation: OrchestrationContext,
    requestContext?: AuditRequestContext,
    topicId?: string | null,
  ): Promise<TutoringTurnReceipt> {
    if (correctnessSensitive) {
      return this.persistUnsupportedCorrectnessSensitive(
        turn,
        operation,
        requestContext,
        topicId,
      )
    }

    let completed: FinalizeTutoringTurnResult
    try {
      completed = await this.turnRepository.blockTurn({
        courseId: turn.courseId,
        sessionId: operation.sessionId,
        studentId: operation.studentId,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: GROUNDING_BLOCKED_CONTENT,
        errorCode: GROUNDING_INSUFFICIENT_EVIDENCE,
        ...(topicId === undefined ? {} : { topicId }),
      })
    } catch (error) {
      this.logFailure('blocked_persistence', operation, error)
      return this.persistFailure(turn, operation, topicId)
    }

    switch (completed.kind) {
      case 'ok':
        return this.presentTurn(turn.studentMessage, completed.message)
      case 'membership_missing':
      case 'session_not_found':
      case 'message_not_found':
      case 'message_not_pending':
        this.logResultFailure('blocked_persistence', operation, completed.kind)
        return this.persistFailure(turn, operation, topicId)
      default:
        return assertNever(completed)
    }
  }

  private async persistControlledConflict(
    turn: ActiveTutoringTurn,
    conflict: ControlledSourceConflict,
    operation: OrchestrationContext,
    requestContext?: AuditRequestContext,
    topicId?: string | null,
  ): Promise<TutoringTurnReceipt> {
    const decision = this.responseGovernance.evaluate({
      proposedContent: GROUNDING_BLOCKED_CONTENT,
      controlledConflictKind: conflict.kind,
      assessment: {
        support: 'CONFLICTING',
        policyCheck: 'PASSED',
        answerRisk: 'NONE',
        citations: 'PRESENT',
      },
      evidence: conflict.sources.map((source) => ({
        materialId: source.materialId,
        materialTitle: source.materialTitle,
        chunkId: source.chunkId,
        chunkIndex: source.chunkIndex,
        excerpt: source.content,
        rank: source.rank,
        score: source.similarityScore,
      })),
      reviewFacts: [
        { code: 'detector_version', value: conflict.detectorVersion },
        {
          code: 'embedding_model',
          value: requireSingleEmbeddingModel(conflict.sources),
        },
      ],
    })

    return this.persistAutomaticPolicyTurn(
      turn,
      operation,
      () =>
        this.turnRepository.completePolicyTurn({
          courseId: turn.courseId,
          sessionId: operation.sessionId,
          studentId: operation.studentId,
          attemptId: turn.attemptId,
          studentMessageId: turn.studentMessage.id,
          assistantMessageId: turn.assistantMessage.id,
          content: decision.content,
          ...(topicId === undefined ? {} : { topicId }),
          guidanceLabel: decision.studentStatus.guidanceLabel,
          errorCode: encodeAutomaticPolicyReasons(decision.reasons),
          evidence: conflict.sources,
          automaticReview: policyReviewInput(
            turn.assistantMessage.id,
            decision,
            requestContext,
          ),
        }),
      'finalization',
      topicId,
    )
  }

  private async persistUnsupportedCorrectnessSensitive(
    turn: ActiveTutoringTurn,
    operation: OrchestrationContext,
    requestContext?: AuditRequestContext,
    topicId?: string | null,
  ): Promise<TutoringTurnReceipt> {
    const decision = this.responseGovernance.evaluate({
      proposedContent: GROUNDING_BLOCKED_CONTENT,
      assessment: {
        support: 'NOT_FOUND',
        policyCheck: 'PASSED',
        answerRisk: 'NONE',
        citations: 'NOT_REQUIRED',
      },
    })

    return this.persistAutomaticPolicyTurn(
      turn,
      operation,
      () =>
        this.turnRepository.completeUnsupportedTurn({
          courseId: turn.courseId,
          sessionId: operation.sessionId,
          studentId: operation.studentId,
          attemptId: turn.attemptId,
          studentMessageId: turn.studentMessage.id,
          assistantMessageId: turn.assistantMessage.id,
          content: decision.content,
          ...(topicId === undefined ? {} : { topicId }),
          errorCode: encodeAutomaticPolicyReasons(decision.reasons),
          automaticReview: policyReviewInput(
            turn.assistantMessage.id,
            decision,
            requestContext,
          ),
        }),
      'unsupported_persistence',
      topicId,
    )
  }

  private async persistSafetyRefusal(
    turn: ActiveTutoringTurn,
    detection: AutomaticSafetyRiskDetection,
    operation: OrchestrationContext,
    requestContext?: AuditRequestContext,
    topicId?: string | null,
  ): Promise<TutoringTurnReceipt> {
    const decision = this.responseGovernance.evaluate({
      proposedContent: GROUNDING_BLOCKED_CONTENT,
      assessment: {
        support: 'SUPPORTED',
        policyCheck: detection.risks.some(
          (risk) => risk !== 'FINAL_ANSWER_DELIVERY',
        )
          ? 'FAILED'
          : 'PASSED',
        answerRisk: detection.risks.includes('FINAL_ANSWER_DELIVERY')
          ? 'FINAL_ANSWER'
          : 'NONE',
        citations: 'NOT_REQUIRED',
      },
      reviewFacts: [
        { code: 'detector_version', value: detection.detectorVersion },
      ],
    })

    return this.persistAutomaticPolicyTurn(
      turn,
      operation,
      () =>
        this.turnRepository.completeSafetyTurn({
          courseId: turn.courseId,
          sessionId: operation.sessionId,
          studentId: operation.studentId,
          attemptId: turn.attemptId,
          studentMessageId: turn.studentMessage.id,
          assistantMessageId: turn.assistantMessage.id,
          content: decision.content,
          ...(topicId === undefined ? {} : { topicId }),
          guidanceLabel: decision.studentStatus.guidanceLabel,
          errorCode: encodeAutomaticPolicyReasons(decision.reasons),
          automaticReview: policyReviewInput(
            turn.assistantMessage.id,
            decision,
            requestContext,
          ),
        }),
      'finalization',
      topicId,
    )
  }

  private async persistAutomaticPolicyTurn(
    turn: ActiveTutoringTurn,
    operation: OrchestrationContext,
    finalize: () => Promise<FinalizeTutoringTurnResult>,
    phase: OrchestrationPhase = 'finalization',
    topicId?: string | null,
  ): Promise<TutoringTurnReceipt> {
    let completed: FinalizeTutoringTurnResult
    try {
      completed = await finalize()
    } catch (error) {
      this.logFailure(phase, operation, error)
      return this.persistFailure(turn, operation, topicId)
    }

    switch (completed.kind) {
      case 'ok':
        return this.presentFinalizedPolicyTurn(
          turn.studentMessage,
          completed.message,
          operation,
        )
      case 'membership_missing':
      case 'session_not_found':
      case 'message_not_found':
      case 'message_not_pending':
        this.logResultFailure('finalization', operation, completed.kind)
        return this.persistFailure(turn, operation, topicId)
      default:
        return assertNever(completed)
    }
  }

  private async presentReplayedTurn(
    studentMessage: ChatMessageRecord,
    assistantMessage: ChatMessageRecord,
    operation: OrchestrationContext,
  ): Promise<TutoringTurnReceipt> {
    const reasons = decodeAutomaticPolicyReasons(assistantMessage.errorCode)
    if (reasons !== null && assistantMessage.attemptId !== null) {
      const decision = this.recreatePolicyDecision(assistantMessage, reasons)
      const automaticReview = policyReviewInput(
        assistantMessage.id,
        decision,
        undefined,
      )
      if (automaticReview !== undefined) {
        const repaired = await this.turnRepository.repairAutomaticReview({
          courseId: operation.courseId,
          sessionId: operation.sessionId,
          studentId: operation.studentId,
          attemptId: assistantMessage.attemptId,
          studentMessageId: studentMessage.id,
          assistantMessageId: assistantMessage.id,
          automaticReview,
        })
        if (repaired.kind !== 'ok') {
          throw tutoringTerminalStateUnavailableException()
        }
      }
    }
    return this.presentFinalizedPolicyTurn(
      studentMessage,
      assistantMessage,
      operation,
    )
  }

  private recreatePolicyDecision(
    message: ChatMessageRecord,
    reasons: readonly AutomaticPolicyReason[],
  ): ResponseGovernanceDecision {
    const evidence = policyEvidenceFrom(message)
    return this.responseGovernance.evaluate({
      proposedContent: message.content,
      assessment: {
        support: reasons.includes('GENERAL_NOT_FOUND')
          ? 'NOT_FOUND'
          : reasons.includes('SOURCE_CONFLICT')
            ? 'CONFLICTING'
            : 'SUPPORTED',
        policyCheck: reasons.includes('POLICY_CHECK_FAILED')
          ? 'FAILED'
          : 'PASSED',
        answerRisk: reasons.includes('FINAL_ANSWER_RISK')
          ? 'FINAL_ANSWER'
          : 'NONE',
        citations: reasons.includes('CITATION_MISSING')
          ? 'MISSING'
          : evidence.length === 0
            ? 'NOT_REQUIRED'
            : 'PRESENT',
      },
      evidence,
      reviewFacts: replayReviewFacts(message, reasons),
    })
  }

  private async presentFinalizedPolicyTurn(
    studentMessage: ChatMessageRecord,
    assistantMessage: ChatMessageRecord,
    operation: OrchestrationContext,
  ): Promise<TutoringTurnReceipt> {
    const [refreshedStudent, refreshedAssistant] = await Promise.all([
      this.conversationMessageReader.find({
        id: studentMessage.id,
        studentId: operation.studentId,
      }),
      this.conversationMessageReader.find({
        id: assistantMessage.id,
        studentId: operation.studentId,
      }),
    ])
    return this.presentTurn(
      refreshedStudent ?? studentMessage,
      refreshedAssistant ?? assistantMessage,
    )
  }

  private async persistBlocked(
    turn: ActiveTutoringTurn,
    operation: OrchestrationContext,
  ): Promise<TutoringTurnReceipt> {
    return this.persistTerminal(turn, operation, {
      kind: 'blocked',
      phase: 'blocked_persistence',
      content: GROUNDING_BLOCKED_CONTENT,
      errorCode: GROUNDING_INSUFFICIENT_EVIDENCE,
    })
  }

  private async persistFailure(
    turn: ActiveTutoringTurn,
    operation: OrchestrationContext,
    topicId?: string | null,
  ): Promise<TutoringTurnReceipt> {
    return this.persistTerminal(turn, operation, {
      kind: 'failed',
      phase: 'failed_persistence',
      content: GROUNDING_FAILED_CONTENT,
      errorCode: GROUNDING_RESPONSE_FAILED,
      topicId,
    })
  }

  private async persistTerminal(
    turn: ActiveTutoringTurn,
    operation: OrchestrationContext,
    terminal: TerminalPersistence,
  ): Promise<TutoringTurnReceipt> {
    try {
      const input = {
        courseId: turn.courseId,
        sessionId: operation.sessionId,
        studentId: operation.studentId,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: terminal.content,
        errorCode: terminal.errorCode,
        ...(terminal.topicId === undefined
          ? {}
          : { topicId: terminal.topicId }),
        ...(terminal.guidanceLabel === undefined
          ? {}
          : { guidanceLabel: terminal.guidanceLabel }),
      }
      let result: FinalizeTutoringTurnResult
      switch (terminal.kind) {
        case 'blocked':
          result = await this.turnRepository.blockTurn(input)
          break
        case 'failed':
          result = await this.turnRepository.failTurn(input)
          break
        default:
          return assertNever(terminal)
      }

      switch (result.kind) {
        case 'ok':
          return await this.presentTurn(
            await this.reloadStudentMessage(turn.studentMessage),
            result.message,
          )
        case 'membership_missing':
        case 'session_not_found':
        case 'message_not_found':
        case 'message_not_pending':
          this.logResultFailure(terminal.phase, operation, result.kind)
          break
        default:
          return assertNever(result)
      }
    } catch (error) {
      this.logFailure(terminal.phase, operation, error)
    }

    if (terminal.kind === 'blocked') {
      return this.persistFailure(turn, operation, terminal.topicId)
    }

    throw tutoringTerminalStateUnavailableException()
  }

  private async presentTurn(
    studentMessage: ChatMessageRecord,
    assistantMessage: ChatMessageRecord,
  ): Promise<TutoringTurnReceipt> {
    const [presentedStudent, presentedAssistant] =
      await this.messagePresenter.presentMany([
        studentMessage,
        assistantMessage,
      ])
    return {
      studentMessage: presentedStudent,
      assistantMessage: presentedAssistant,
    }
  }

  private async reloadStudentMessage(
    fallback: ChatMessageRecord,
  ): Promise<ChatMessageRecord> {
    try {
      return (
        (await this.conversationMessageReader.find({ id: fallback.id })) ??
        fallback
      )
    } catch (error) {
      this.logger.warn({
        event: 'student_message_metadata_reload_failed',
        messageId: fallback.id,
        ...safeErrorDescriptor(error),
      })
      return fallback
    }
  }

  private async handleBeginDenial(
    result: Exclude<
      BeginTutoringTurnResult,
      { kind: 'ok' } | { kind: 'replayed' }
    >,
    courseId: string,
    sessionId: string,
    studentId: string,
    requestContext?: AuditRequestContext,
  ): Promise<never> {
    switch (result.kind) {
      case 'membership_missing':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
          requestContext,
        })
        throw tutoringActiveStudentMembershipRequiredException()
      case 'session_not_found':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'DELETED_OR_UNOWNED',
          requestContext,
        })
        throw tutoringSessionNotFoundException()
      case 'turn_in_progress':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'TURN_IN_PROGRESS',
          requestContext,
        })
        throw tutoringTurnInProgressException()
      default:
        return assertNever(result)
    }
  }

  private async handleRetryDenial(
    result: Exclude<RetryTutoringTurnResult, { kind: 'ok' }>,
    courseId: string,
    sessionId: string,
    studentId: string,
    studentMessageId: string,
    requestContext?: AuditRequestContext,
  ): Promise<never> {
    switch (result.kind) {
      case 'membership_missing':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
          requestContext,
        })
        throw tutoringActiveStudentMembershipRequiredException()
      case 'session_not_found':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'DELETED_OR_UNOWNED',
          requestContext,
        })
        throw tutoringSessionNotFoundException()
      case 'message_not_found':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          messageId: studentMessageId,
          reason: 'RETRY_TARGET_NOT_FOUND',
          requestContext,
        })
        throw tutoringRetryTargetNotFoundException()
      case 'retry_not_allowed':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          messageId: studentMessageId,
          reason: 'RETRY_NOT_ALLOWED',
          requestContext,
        })
        throw tutoringRetryNotAllowedException()
      case 'turn_in_progress':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'TURN_IN_PROGRESS',
          requestContext,
        })
        throw tutoringTurnInProgressException()
      default:
        return assertNever(result)
    }
  }

  private logFailure(
    phase: OrchestrationPhase,
    operation: OrchestrationContext,
    error: unknown,
  ): void {
    this.logger.warn({
      event: 'tutoring_runtime_phase_failed',
      phase,
      ...safeErrorDescriptor(error),
      ...operation,
    })
  }

  private logResultFailure(
    phase: OrchestrationPhase,
    operation: OrchestrationContext,
    resultKind: Exclude<FinalizeTutoringTurnResult['kind'], 'ok'>,
  ): void {
    this.logger.warn({
      event: 'tutoring_runtime_phase_failed',
      phase,
      errorClass: 'RepositoryResult',
      errorCode: resultKind,
      ...operation,
    })
  }

  private recordDenial(input: TutoringTurnDenialInput): Promise<void> {
    return this.auditService
      .recordEvent({
        actorUserId: input.studentId,
        action: AUDIT_EVENT_ACTIONS.CHAT_SESSION_ACCESS_DENIED,
        target: {
          type: AUDIT_TARGET_TYPES.CHAT_SESSION,
          id: input.sessionId,
        },
        courseId: input.courseId,
        metadata: {
          reason: input.reason,
          ...(input.messageId === undefined
            ? {}
            : { messageId: input.messageId }),
        },
        requestContext: input.requestContext,
      })
      .then(() => undefined)
      .catch((error: unknown) => {
        this.logger.error(
          'Failed to record tutoring access-denied audit event',
          error instanceof Error ? error.stack : undefined,
        )
      })
  }
}

function safeErrorDescriptor(error: unknown): {
  errorClass: string
  errorCode?: string
} {
  if (isPrismaKnownRequestError(error)) {
    return {
      errorClass: 'PrismaClientKnownRequestError',
      ...(isSafePrismaCode(error.code) ? { errorCode: error.code } : {}),
    }
  }
  if (error instanceof TypeError) {
    return { errorClass: 'TypeError' }
  }
  if (error instanceof Error) {
    return { errorClass: 'Error' }
  }

  return { errorClass: 'UnknownError' }
}

function requireSingleEmbeddingModel(
  sources: ControlledSourceConflict['sources'],
): string {
  const models = new Set(sources.map(({ embeddingModel }) => embeddingModel))
  if (models.size !== 1) {
    throw new TypeError('Conflict sources must share one embedding profile')
  }
  return sources[0].embeddingModel
}

function policyEvidenceFrom(
  message: ChatMessageRecord,
): ResponseGovernanceEvidenceSource[] {
  const titleByMaterialId = new Map(
    message.citations.map(({ material }) => [material.id, material.title]),
  )
  return message.retrievals.flatMap((retrieval) => {
    if (retrieval.chunk === null) {
      return []
    }
    return [
      {
        materialId: retrieval.chunk.materialId,
        ...(titleByMaterialId.get(retrieval.chunk.materialId) === undefined
          ? {}
          : {
              materialTitle: titleByMaterialId.get(retrieval.chunk.materialId),
            }),
        chunkId: retrieval.chunk.id,
        chunkIndex: retrieval.chunk.chunkIndex,
        excerpt: retrieval.chunk.content,
        rank: retrieval.rank,
        ...(retrieval.similarityScore === null
          ? {}
          : { score: retrieval.similarityScore.toNumber() }),
      },
    ]
  })
}

function replayReviewFacts(
  message: ChatMessageRecord,
  reasons: readonly AutomaticPolicyReason[],
): ResponseGovernanceReviewFact[] {
  if (reasons.includes('SOURCE_CONFLICT')) {
    const embeddingModels = new Set(
      message.retrievals.flatMap(({ chunk }) =>
        chunk === null ? [] : [chunk.embeddingModel],
      ),
    )
    const facts: ResponseGovernanceReviewFact[] = [
      {
        code: 'detector_version',
        value: CONTROLLED_SOURCE_CONFLICT_DETECTOR_VERSION,
      },
    ]
    if (embeddingModels.size === 1) {
      facts.push({
        code: 'embedding_model',
        value: [...embeddingModels][0],
      })
    }
    return facts
  }
  if (
    reasons.includes('POLICY_CHECK_FAILED') ||
    reasons.includes('FINAL_ANSWER_RISK')
  ) {
    return [
      {
        code: 'detector_version',
        value: AUTOMATIC_SAFETY_RISK_DETECTOR_VERSION,
      },
    ]
  }
  return []
}

function policyReviewInput(
  assistantMessageId: string,
  decision: ResponseGovernanceDecision,
  requestContext: AuditRequestContext | undefined,
): Omit<AutomaticReviewIntakeInput, 'messageId'> | undefined {
  if (!decision.createReview) {
    return undefined
  }
  if (decision.reasons.length === 0 || decision.reviewEvidence === null) {
    throw new Error('Automatic response review input is incomplete')
  }

  return {
    triggers: decision.reasons.map((reason) => ({
      trigger: reason,
      sourceEventKey: sourceEventKey(assistantMessageId, reason),
      detectorMetadata: {
        policyVersion: RESPONSE_GOVERNANCE_VERSION,
        reasonCount: decision.reasons.length,
        ...metadataFrom(decision),
      },
    })),
    evidence: decision.reviewEvidence,
    requestContext,
  }
}

function metadataFrom(
  decision: ResponseGovernanceDecision,
): Record<string, string | number | boolean> {
  const metadata: Record<string, string | number | boolean> = {}
  for (const fact of decision.reviewEvidence?.facts ?? []) {
    switch (fact.code) {
      case 'detector_version':
        metadata.detectorVersion = fact.value
        break
      case 'embedding_model':
        metadata.embeddingModel = fact.value
        break
    }
  }
  return metadata
}

function sourceEventKey(messageId: string, reason: string): string {
  const messageDigest = createHash('sha256')
    .update(messageId, 'utf8')
    .digest('hex')
    .slice(0, 32)
  return `${RESPONSE_GOVERNANCE_VERSION}:${messageDigest}:${reason}`
}

function isSafePrismaCode(code: string): boolean {
  return /^P\d{4}$/u.test(code)
}

function assertNever(_value: never): never {
  throw new Error('Unhandled tutoring runtime result')
}
