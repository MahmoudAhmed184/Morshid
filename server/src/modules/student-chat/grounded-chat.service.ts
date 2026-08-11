import { createHash, randomUUID } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'

import {
  MessageGuidanceLabel,
  MessageRequestKind,
  Prisma,
} from '../../generated/prisma/client'
import type { AuthenticatedUser } from '../identity/identity.types'
import { TutoringRuntime } from '../tutoring/interface/tutoring-runtime'
import type { RunTutoringTurnCommand } from '../tutoring/interface/run-tutoring-turn-command'
import type { TutoringTurnReceipt } from '../tutoring/interface/tutoring-turn-receipt'
import type { AuditRequestContext } from '../audit/audit.public'
import { PrismaService } from '../prisma/prisma.service'
import {
  AutomaticSafetyRiskDetector,
  AUTOMATIC_SAFETY_RISK_DETECTOR_VERSION,
  type AutomaticSafetyRiskDetection,
} from '../output-policy/automatic-safety-risk.detector'
import {
  selectTutorStrategy,
  type TutorStrategySelection,
} from '../tutor/tutor-decision'
import { PYTHON_CODE_DIAGNOSIS_BOUNDARY_ERROR_CODES } from '../tutor/code-diagnosis/python-code-diagnosis.boundary-response'
import {
  ControlledSourceConflictDetector,
  CONTROLLED_SOURCE_CONFLICT_DETECTOR_VERSION,
  type ControlledSourceConflict,
} from '../output-policy/controlled-source-conflict.detector'
import {
  decodeAutomaticPolicyReasons,
  OUTPUT_POLICY_VERSION,
  encodeAutomaticPolicyReasons,
  type AutomaticPolicyReason,
  type OutputPolicyDecision,
  type OutputPolicyEvidenceSource,
  type OutputPolicyReviewFact,
} from '../output-policy/output-policy.contract'
import { OutputPolicyService } from '../output-policy/output-policy.service'
import type { AutomaticReviewIntakeInput } from '../reviews/reviews.public'
import {
  type BeginGroundedChatTurnResult,
  type FinalizeGroundedChatTurnResult,
  GroundedChatTurnRepository,
  type RetryGroundedChatTurnResult,
} from './grounded-chat-turn.repository'
import { SocraticChatOrchestrator } from './socratic-chat.orchestrator'
import type {
  GroundedChatTurnResponseDto,
  SendStudentChatMessageRequest,
} from './student-chat.dto'
import {
  activeStudentMembershipRequiredException,
  chatSessionNotFoundException,
  studentChatRetryNotAllowedException,
  studentChatRetryTargetNotFoundException,
  studentChatTerminalStateUnavailableException,
  studentChatTurnInProgressException,
} from './student-chat.errors'
import { StudentChatMessagePresenter } from './student-chat-message.presenter'
import type { ChatMessageRecord } from './student-chat.repository.types'
import {
  chatMessageSelect,
  chatMessageSelectForStudent,
} from './student-chat.repository.support'
import { StudentChatService } from './student-chat.service'
import {
  GROUNDING_BLOCKED_CONTENT,
  GROUNDING_INSUFFICIENT_EVIDENCE,
  GROUNDING_FAILED_CONTENT,
  GROUNDING_RESPONSE_FAILED,
} from './grounded-chat.constants'
import { CorrectnessSensitiveRequestClassifier } from './correctness-sensitive-request.classifier'
import type { SocraticTopicSelection } from './socratic-chat.types'
import {
  assertRequestBudget,
  type RequestBudget,
} from '../../common/http/request-deadline'

export {
  GROUNDING_BLOCKED_CONTENT,
  GROUNDING_FAILED_CONTENT,
} from './grounded-chat.constants'

interface ActiveGroundedTurn {
  courseId: string
  attemptId: string
  studentMessage: ChatMessageRecord
  assistantMessage: ChatMessageRecord
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
  | 'completion'
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
      guidanceLabel?: MessageGuidanceLabel
    }
  | {
      kind: 'failed'
      phase: 'failed_persistence'
      content: string
      errorCode: string
      guidanceLabel?: MessageGuidanceLabel
    }

@Injectable()
export class GroundedChatService extends TutoringRuntime {
  private readonly logger = new Logger(GroundedChatService.name)

  constructor(
    private readonly studentChatService: StudentChatService,
    private readonly turnRepository: GroundedChatTurnRepository,
    private readonly messagePresenter: StudentChatMessagePresenter,
    private readonly socraticOrchestrator: SocraticChatOrchestrator,
    private readonly prismaService: PrismaService,
    private readonly safetyRiskDetector: AutomaticSafetyRiskDetector,
    private readonly conflictDetector: ControlledSourceConflictDetector,
    private readonly outputPolicy: OutputPolicyService,
    private readonly requestClassifier: CorrectnessSensitiveRequestClassifier,
  ) {
    super()
  }

  run(command: RunTutoringTurnCommand): Promise<TutoringTurnReceipt> {
    if (command.kind === 'new') {
      return this.send(
        command.courseId,
        command.sessionId,
        {
          content: command.content,
          ...(command.clientMessageId === undefined
            ? {}
            : { clientMessageId: command.clientMessageId }),
          ...(command.problemId === undefined
            ? {}
            : { problemId: command.problemId }),
          ...(command.conceptId === undefined
            ? {}
            : { conceptId: command.conceptId }),
          ...(command.title === undefined ? {} : { title: command.title }),
        },
        { id: command.studentId },
        command.requestContext,
        command.requestBudget,
      )
    }

    return this.retry(
      command.courseId,
      command.sessionId,
      command.studentMessageId,
      { id: command.studentId },
      command.requestContext,
      command.requestBudget,
    )
  }

  async send(
    courseId: string,
    sessionId: string,
    body: SendStudentChatMessageRequest,
    user: Pick<AuthenticatedUser, 'id'>,
    requestContext?: AuditRequestContext,
    requestBudget?: RequestBudget,
  ): Promise<GroundedChatTurnResponseDto> {
    assertRequestBudget(requestBudget)
    const selection = selectTutorStrategy(body.content)
    const operation: OrchestrationContext = {
      operationId: randomUUID(),
      courseId,
      sessionId,
      studentId: user.id,
    }
    await this.studentChatService.getSession(
      courseId,
      sessionId,
      user,
      requestContext,
    )

    const classification = this.requestClassifier.classify(body.content)
    let result: BeginGroundedChatTurnResult
    try {
      result = await this.turnRepository.beginTurn({
        courseId,
        sessionId,
        studentId: user.id,
        ...(body.clientMessageId === undefined
          ? {}
          : { clientMessageId: body.clientMessageId }),
        content: body.content,
        requestKind:
          selection.decision.requestKind === MessageRequestKind.CODE_DIAGNOSIS
            ? selection.decision.requestKind
            : classification.requestKind,
      })
    } catch (error) {
      this.logFailure('begin', operation, error)
      throw studentChatTerminalStateUnavailableException()
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
        user.id,
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
        problemId: body.problemId,
        conceptId: body.conceptId,
        title: body.title,
      },
      requestBudget,
    )
  }

  async retry(
    courseId: string,
    sessionId: string,
    studentMessageId: string,
    user: Pick<AuthenticatedUser, 'id'>,
    requestContext?: AuditRequestContext,
    requestBudget?: RequestBudget,
  ): Promise<GroundedChatTurnResponseDto> {
    assertRequestBudget(requestBudget)
    const operation: OrchestrationContext = {
      operationId: randomUUID(),
      courseId,
      sessionId,
      studentId: user.id,
      studentMessageId,
    }
    await this.studentChatService.getSession(
      courseId,
      sessionId,
      user,
      requestContext,
    )

    let result: RetryGroundedChatTurnResult
    try {
      result = await this.turnRepository.retryTurn({
        courseId,
        sessionId,
        studentId: user.id,
        studentMessageId,
      })
    } catch (error) {
      this.logFailure('retry', operation, error)
      throw studentChatTerminalStateUnavailableException()
    }
    if (result.kind !== 'ok') {
      return this.handleRetryDenial(
        result,
        courseId,
        sessionId,
        user.id,
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
    turn: ActiveGroundedTurn,
    operation: OrchestrationContext,
    requestContext?: AuditRequestContext,
    preparedSelection?: TutorStrategySelection,
    topicSelection?: SocraticTopicSelection,
    requestBudget?: RequestBudget,
  ): Promise<GroundedChatTurnResponseDto> {
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
      )
    }

    const selection =
      preparedSelection ?? selectTutorStrategy(turn.studentMessage.content)
    const shouldContinueThroughSafetyPipeline =
      classification.correctnessSensitive &&
      selection.boundaryResponse?.errorCode ===
        PYTHON_CODE_DIAGNOSIS_BOUNDARY_ERROR_CODES.INSUFFICIENT_INFORMATION
    if (
      selection.boundaryResponse !== null &&
      !shouldContinueThroughSafetyPipeline
    ) {
      return this.persistTerminal(turn, operation, {
        kind: 'blocked',
        phase: 'blocked_persistence',
        content: selection.boundaryResponse.content,
        errorCode: selection.boundaryResponse.errorCode,
        guidanceLabel: selection.boundaryResponse.guidanceLabel,
      })
    }

    let orchestratorResult
    try {
      orchestratorResult = await this.socraticOrchestrator.orchestrate({
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
        return this.presentTurn(
          orchestratorResult.studentMessage,
          orchestratorResult.assistantMessage,
        )
      case 'safety_refusal':
        return this.persistSafetyRefusal(
          turn,
          orchestratorResult.detection,
          operation,
          requestContext,
        )
      case 'source_conflict':
        return this.persistControlledConflict(
          turn,
          orchestratorResult.conflict,
          operation,
          requestContext,
        )
      case 'blocked':
        return this.persistInsufficientEvidence(
          turn,
          classification.correctnessSensitive,
          operation,
          requestContext,
        )
      case 'failed':
        return this.persistFailure(turn, operation)
    }
  }

  private async persistInsufficientEvidence(
    turn: ActiveGroundedTurn,
    correctnessSensitive: boolean,
    operation: OrchestrationContext,
    requestContext?: AuditRequestContext,
  ): Promise<GroundedChatTurnResponseDto> {
    if (correctnessSensitive) {
      return this.persistUnsupportedCorrectnessSensitive(
        turn,
        operation,
        requestContext,
      )
    }

    let completed: FinalizeGroundedChatTurnResult
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
      })
    } catch (error) {
      this.logFailure('blocked_persistence', operation, error)
      return this.persistFailure(turn, operation)
    }

    switch (completed.kind) {
      case 'ok':
        return this.presentTurn(turn.studentMessage, completed.message)
      case 'membership_missing':
      case 'session_not_found':
      case 'message_not_found':
      case 'message_not_pending':
        this.logResultFailure('blocked_persistence', operation, completed.kind)
        return this.persistFailure(turn, operation)
      default:
        return assertNever(completed)
    }
  }

  private async persistControlledConflict(
    turn: ActiveGroundedTurn,
    conflict: ControlledSourceConflict,
    operation: OrchestrationContext,
    requestContext?: AuditRequestContext,
  ): Promise<GroundedChatTurnResponseDto> {
    const decision = this.outputPolicy.evaluate({
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

    return this.persistAutomaticPolicyTurn(turn, operation, () =>
      this.turnRepository.completePolicyTurn({
        courseId: turn.courseId,
        sessionId: operation.sessionId,
        studentId: operation.studentId,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: decision.content,
        guidanceLabel: decision.studentStatus.guidanceLabel,
        errorCode: encodeAutomaticPolicyReasons(decision.reasons),
        evidence: conflict.sources,
        automaticReview: policyReviewInput(
          turn.assistantMessage.id,
          decision,
          requestContext,
        ),
      }),
    )
  }

  private async persistUnsupportedCorrectnessSensitive(
    turn: ActiveGroundedTurn,
    operation: OrchestrationContext,
    requestContext?: AuditRequestContext,
  ): Promise<GroundedChatTurnResponseDto> {
    const decision = this.outputPolicy.evaluate({
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
          errorCode: encodeAutomaticPolicyReasons(decision.reasons),
          automaticReview: policyReviewInput(
            turn.assistantMessage.id,
            decision,
            requestContext,
          ),
        }),
      'unsupported_persistence',
    )
  }

  private async persistSafetyRefusal(
    turn: ActiveGroundedTurn,
    detection: AutomaticSafetyRiskDetection,
    operation: OrchestrationContext,
    requestContext?: AuditRequestContext,
  ): Promise<GroundedChatTurnResponseDto> {
    const decision = this.outputPolicy.evaluate({
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

    return this.persistAutomaticPolicyTurn(turn, operation, () =>
      this.turnRepository.completeSafetyTurn({
        courseId: turn.courseId,
        sessionId: operation.sessionId,
        studentId: operation.studentId,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: decision.content,
        guidanceLabel: decision.studentStatus.guidanceLabel,
        errorCode: encodeAutomaticPolicyReasons(decision.reasons),
        automaticReview: policyReviewInput(
          turn.assistantMessage.id,
          decision,
          requestContext,
        ),
      }),
    )
  }

  private async persistAutomaticPolicyTurn(
    turn: ActiveGroundedTurn,
    operation: OrchestrationContext,
    finalize: () => Promise<FinalizeGroundedChatTurnResult>,
    phase: OrchestrationPhase = 'finalization',
  ): Promise<GroundedChatTurnResponseDto> {
    let completed: FinalizeGroundedChatTurnResult
    try {
      completed = await finalize()
    } catch (error) {
      this.logFailure(phase, operation, error)
      return this.persistFailure(turn, operation)
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
        console.log('finalization result failure:', completed.kind)
        this.logResultFailure('finalization', operation, completed.kind)
        return this.persistFailure(turn, operation)
      default:
        return assertNever(completed)
    }
  }

  private async presentReplayedTurn(
    studentMessage: ChatMessageRecord,
    assistantMessage: ChatMessageRecord,
    operation: OrchestrationContext,
  ): Promise<GroundedChatTurnResponseDto> {
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
          throw studentChatTerminalStateUnavailableException()
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
  ): OutputPolicyDecision {
    const evidence = policyEvidenceFrom(message)
    return this.outputPolicy.evaluate({
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
  ): Promise<GroundedChatTurnResponseDto> {
    const [refreshedStudent, refreshedAssistant] = await Promise.all([
      this.prismaService.message.findUnique({
        where: { id: studentMessage.id },
        select: chatMessageSelectForStudent(operation.studentId),
      }),
      this.prismaService.message.findUnique({
        where: { id: assistantMessage.id },
        select: chatMessageSelectForStudent(operation.studentId),
      }),
    ])
    return this.presentTurn(
      refreshedStudent ?? studentMessage,
      refreshedAssistant ?? assistantMessage,
    )
  }

  private async persistBlocked(
    turn: ActiveGroundedTurn,
    operation: OrchestrationContext,
  ): Promise<GroundedChatTurnResponseDto> {
    return this.persistTerminal(turn, operation, {
      kind: 'blocked',
      phase: 'blocked_persistence',
      content: GROUNDING_BLOCKED_CONTENT,
      errorCode: GROUNDING_INSUFFICIENT_EVIDENCE,
    })
  }

  private async persistFailure(
    turn: ActiveGroundedTurn,
    operation: OrchestrationContext,
  ): Promise<GroundedChatTurnResponseDto> {
    return this.persistTerminal(turn, operation, {
      kind: 'failed',
      phase: 'failed_persistence',
      content: GROUNDING_FAILED_CONTENT,
      errorCode: GROUNDING_RESPONSE_FAILED,
    })
  }

  private async persistTerminal(
    turn: ActiveGroundedTurn,
    operation: OrchestrationContext,
    terminal: TerminalPersistence,
  ): Promise<GroundedChatTurnResponseDto> {
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
        ...(terminal.guidanceLabel === undefined
          ? {}
          : { guidanceLabel: terminal.guidanceLabel }),
      }
      let result: FinalizeGroundedChatTurnResult
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
      return this.persistFailure(turn, operation)
    }

    throw studentChatTerminalStateUnavailableException()
  }

  private async presentTurn(
    studentMessage: ChatMessageRecord,
    assistantMessage: ChatMessageRecord,
  ): Promise<GroundedChatTurnResponseDto> {
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
        (await this.prismaService.message.findUnique({
          where: { id: fallback.id },
          select: chatMessageSelect,
        })) ?? fallback
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
      BeginGroundedChatTurnResult,
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
        throw activeStudentMembershipRequiredException()
      case 'session_not_found':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'DELETED_OR_UNOWNED',
          requestContext,
        })
        throw chatSessionNotFoundException()
      case 'turn_in_progress':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'TURN_IN_PROGRESS',
          requestContext,
        })
        throw studentChatTurnInProgressException()
      default:
        return assertNever(result)
    }
  }

  private async handleRetryDenial(
    result: Exclude<RetryGroundedChatTurnResult, { kind: 'ok' }>,
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
        throw activeStudentMembershipRequiredException()
      case 'session_not_found':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'DELETED_OR_UNOWNED',
          requestContext,
        })
        throw chatSessionNotFoundException()
      case 'message_not_found':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          messageId: studentMessageId,
          reason: 'RETRY_TARGET_NOT_FOUND',
          requestContext,
        })
        throw studentChatRetryTargetNotFoundException()
      case 'retry_not_allowed':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          messageId: studentMessageId,
          reason: 'RETRY_NOT_ALLOWED',
          requestContext,
        })
        throw studentChatRetryNotAllowedException()
      case 'turn_in_progress':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'TURN_IN_PROGRESS',
          requestContext,
        })
        throw studentChatTurnInProgressException()
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
      event: 'grounded_chat_phase_failed',
      phase,
      ...safeErrorDescriptor(error),
      ...operation,
    })
  }

  private logResultFailure(
    phase: OrchestrationPhase,
    operation: OrchestrationContext,
    resultKind: Exclude<FinalizeGroundedChatTurnResult['kind'], 'ok'>,
  ): void {
    this.logger.warn({
      event: 'grounded_chat_phase_failed',
      phase,
      errorClass: 'RepositoryResult',
      errorCode: resultKind,
      ...operation,
    })
  }

  private recordDenial(
    input: Parameters<StudentChatService['recordGroundedTurnDenied']>[0],
  ): Promise<void> {
    return this.studentChatService.recordGroundedTurnDenied(input)
  }
}

function safeErrorDescriptor(error: unknown): {
  errorClass: string
  errorCode?: string
} {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
): OutputPolicyEvidenceSource[] {
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
): OutputPolicyReviewFact[] {
  if (reasons.includes('SOURCE_CONFLICT')) {
    const embeddingModels = new Set(
      message.retrievals.flatMap(({ chunk }) =>
        chunk === null ? [] : [chunk.embeddingModel],
      ),
    )
    const facts: OutputPolicyReviewFact[] = [
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
  decision: OutputPolicyDecision,
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
        policyVersion: OUTPUT_POLICY_VERSION,
        reasonCount: decision.reasons.length,
        ...metadataFrom(decision),
      },
    })),
    evidence: decision.reviewEvidence,
    requestContext,
  }
}

function metadataFrom(
  decision: OutputPolicyDecision,
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
  return `${OUTPUT_POLICY_VERSION}:${messageDigest}:${reason}`
}

function isSafePrismaCode(code: string): boolean {
  return /^P\d{4}$/u.test(code)
}

function assertNever(_value: never): never {
  throw new Error('Unhandled grounded chat result')
}
