import { randomUUID } from 'node:crypto'

import { Inject, Injectable, Logger } from '@nestjs/common'

import {
  MessageGuidanceLabel,
  MessageRequestKind,
  Prisma,
} from '../../generated/prisma/client'
import type { AuthenticatedUser } from '../identity/identity.types'
import type { AuditRequestContext } from '../audit/audit.public'
import { PrismaService } from '../prisma/prisma.service'
import {
  AUTOMATIC_SAFETY_RISK_DETECTOR_VERSION,
  AutomaticSafetyRiskDetector,
  type AutomaticSafetyRiskDetection,
} from '../output-policy/automatic-safety-risk.detector'
import {
  COMPLETION_PROVIDER_TOKEN,
  CompletionProviderError,
  type CompletionProvider,
  type CompletionResult,
  type NonEmptyCompletionContext,
} from '../completion/completion-provider'
import {
  RetrievalService,
  type RetrievedChunk,
} from '../retrieval/retrieval.service'
import {
  selectTutorStrategy,
  type TutorStrategySelection,
} from '../tutor/tutor-decision'
import {
  addFullRewriteRefusal,
  buildSafePythonCodeDiagnosisFallback,
  pythonCodeDiagnosisOutputErrorCode,
  readPythonCodeDiagnosisCitationIndexes,
  validatePythonCodeDiagnosisOutput,
} from '../tutor/code-diagnosis/python-code-diagnosis.output-guard'
import { PYTHON_CODE_DIAGNOSIS_BOUNDARY_ERROR_CODES } from '../tutor/code-diagnosis/python-code-diagnosis.boundary-response'
import {
  OutputPolicyReviewAdapter,
  OutputPolicyReviewIntegrationError,
} from '../output-policy/output-policy-review.adapter'
import {
  CONTROLLED_SOURCE_CONFLICT_DETECTOR_VERSION,
  ControlledSourceConflictDetector,
  type ControlledSourceConflict,
} from '../output-policy/controlled-source-conflict.detector'
import {
  decodeAutomaticPolicyReasons,
  encodeAutomaticPolicyReasons,
  type AutomaticPolicyReason,
  type OutputPolicyDecision,
  type OutputPolicyEvidenceSource,
  type OutputPolicyReviewFact,
} from '../output-policy/output-policy.contract'
import {
  OUTPUT_POLICY_QUESTION_X_SCHEDULE_CONFLICT_CONTENT,
  OutputPolicyService,
} from '../output-policy/output-policy.service'
import {
  type BeginGroundedChatTurnResult,
  type FinalizeGroundedChatTurnResult,
  GroundedChatEvidenceUnavailableError,
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
  | 'review_creation'
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
export class GroundedChatService {
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
    private readonly outputPolicyReviewAdapter: OutputPolicyReviewAdapter,
    private readonly requestClassifier: CorrectnessSensitiveRequestClassifier,
    private readonly retrievalService: RetrievalService,
    @Inject(COMPLETION_PROVIDER_TOKEN)
    private readonly completionProvider: CompletionProvider,
  ) {}

  async send(
    courseId: string,
    sessionId: string,
    body: SendStudentChatMessageRequest,
    user: AuthenticatedUser,
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
        requestContext,
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
      false,
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
    user: AuthenticatedUser,
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
      true,
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
    isRetry = false,
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

    if (selection.diagnosis !== null) {
      return this.orchestrateDiagnosis(
        turn,
        operation,
        selection,
        classification.correctnessSensitive,
        requestContext,
        requestBudget,
      )
    }

    const clientMessageId = isRetry
      ? `${turn.studentMessage.id}:${turn.attemptId}`
      : turn.studentMessage.id

    let orchestratorResult
    try {
      orchestratorResult = await this.socraticOrchestrator.orchestrate({
        courseId: turn.courseId,
        sessionId: operation.sessionId,
        studentId: operation.studentId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        studentMessageContent: turn.studentMessage.content,
        topicSelection,
        clientMessageId,
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

  private async orchestrateDiagnosis(
    turn: ActiveGroundedTurn,
    operation: OrchestrationContext,
    selection: TutorStrategySelection & {
      diagnosis: NonNullable<TutorStrategySelection['diagnosis']>
    },
    correctnessSensitive: boolean,
    requestContext?: AuditRequestContext,
    requestBudget?: RequestBudget,
  ): Promise<GroundedChatTurnResponseDto> {
    assertRequestBudget(requestBudget)
    let evidence: RetrievedChunk[]
    try {
      const retrieval = await this.retrievalService.retrieveCourseEvidence(
        turn.courseId,
        selection.retrievalQuery,
        requestBudget,
      )
      if (retrieval.kind === 'embedding_profile_not_ready') {
        this.logger.warn({
          event: 'grounded_chat_embedding_profile_not_ready',
          expectedModel: retrieval.expectedModel,
          incompleteMaterialIds: retrieval.incompleteMaterialIds,
          ...operation,
        })
        return await this.persistInsufficientEvidence(
          turn,
          correctnessSensitive,
          operation,
          requestContext,
        )
      }
      if (retrieval.kind === 'insufficient_evidence') {
        return await this.persistInsufficientEvidence(
          turn,
          correctnessSensitive,
          operation,
          requestContext,
        )
      }
      evidence = retrieval.chunks
    } catch (error) {
      this.logFailure('retrieval', operation, error)
      return this.persistFailure(turn, operation)
    }

    const documentRisk =
      this.safetyRiskDetector.detectRetrievedDocuments(evidence)
    if (documentRisk !== null) {
      return this.persistSafetyRefusal(
        turn,
        documentRisk,
        operation,
        requestContext,
      )
    }

    const conflict = this.conflictDetector.detect(
      turn.studentMessage.content,
      evidence,
    )
    if (conflict !== null) {
      return this.persistControlledConflict(
        turn,
        conflict,
        operation,
        requestContext,
      )
    }

    const context = toCompletionContext(evidence)
    if (context === null) {
      return this.persistInsufficientEvidence(
        turn,
        correctnessSensitive,
        operation,
        requestContext,
      )
    }

    let completion: CompletionResult
    try {
      assertRequestBudget(requestBudget)
      completion = await this.completionProvider.complete({
        studentQuestion: turn.studentMessage.content,
        context,
        strategy: 'PYTHON_CODE_DIAGNOSIS',
        diagnosis: selection.diagnosis,
        ...(requestBudget === undefined
          ? {}
          : { signal: requestBudget.signal }),
      })
    } catch (error) {
      this.logFailure('completion', operation, error)
      return this.persistFailure(turn, operation)
    }

    let completionContent = completion.content
    const outputPolicyResult = validatePythonCodeDiagnosisOutput({
      content: completion.content,
      authorizedCitationCount: evidence.length,
    })
    if (outputPolicyResult !== 'ALLOWED_DIAGNOSIS') {
      this.logger.warn({
        event: 'python_code_diagnosis_output_blocked',
        outputPolicyResult,
        ...operation,
      })
      return this.persistTerminal(turn, operation, {
        kind: 'blocked',
        phase: 'blocked_persistence',
        content: buildSafePythonCodeDiagnosisFallback(selection.diagnosis),
        errorCode: pythonCodeDiagnosisOutputErrorCode(outputPolicyResult),
        guidanceLabel: MessageGuidanceLabel.REFUSAL,
      })
    }
    const citationContextIndexes =
      readPythonCodeDiagnosisCitationIndexes(
        completion.content,
        evidence.length,
      ) ?? undefined
    if (selection.fullRewriteRequested) {
      completionContent = addFullRewriteRefusal(completion.content)
    }

    const outputRisk = this.safetyRiskDetector.detectOutput(
      completionContent,
      correctnessSensitive,
    )
    if (outputRisk !== null) {
      return this.persistSafetyRefusal(
        turn,
        outputRisk,
        operation,
        requestContext,
      )
    }

    let policyDecision: OutputPolicyDecision
    try {
      policyDecision = this.outputPolicy.evaluate({
        proposedContent: completionContent,
        assessment: {
          support: 'SUPPORTED',
          policyCheck: 'PASSED',
          answerRisk: 'NONE',
          citations: hasDistinctCitation(evidence) ? 'PRESENT' : 'MISSING',
        },
        evidence: evidence.map((chunk) => ({
          materialId: chunk.materialId,
          chunkId: chunk.chunkId,
          excerpt: chunk.content,
          rank: chunk.rank,
          score: chunk.similarityScore,
        })),
      })
    } catch (error) {
      this.logFailure('policy_evaluation', operation, error)
      return this.persistFailure(turn, operation)
    }

    let completed: FinalizeGroundedChatTurnResult
    try {
      completed = await this.turnRepository.completeTurn({
        courseId: turn.courseId,
        sessionId: operation.sessionId,
        studentId: operation.studentId,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: policyDecision.content,
        guidanceLabel: policyDecision.studentStatus.guidanceLabel,
        provider: completion.provider,
        model: completion.model,
        promptVersion: completion.promptVersion,
        ...(completion.inputTokens === undefined
          ? {}
          : { inputTokens: completion.inputTokens }),
        ...(completion.outputTokens === undefined
          ? {}
          : { outputTokens: completion.outputTokens }),
        ...(policyDecision.createReview
          ? { errorCode: encodeAutomaticPolicyReasons(policyDecision.reasons) }
          : {}),
        evidence,
        ...(citationContextIndexes === undefined
          ? {}
          : { citationContextIndexes }),
      })
    } catch (error) {
      this.logFailure('finalization', operation, error)
      return this.persistFailure(turn, operation)
    }
    switch (completed.kind) {
      case 'ok':
        if (policyDecision.createReview) {
          return this.createPolicyReviewAndPresent(
            turn.studentMessage,
            completed.message,
            policyDecision,
            operation,
            requestContext,
          )
        }
        return this.presentTurn(turn.studentMessage, completed.message)
      case 'membership_missing':
      case 'session_not_found':
      case 'message_not_found':
      case 'message_not_pending':
        this.logResultFailure('finalization', operation, completed.kind)
        return this.persistFailure(turn, operation)
      default:
        return assertNever(completed)
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

    return this.persistAutomaticPolicyTurn(
      turn,
      decision,
      operation,
      requestContext,
      () =>
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
      decision,
      operation,
      requestContext,
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

    return this.persistAutomaticPolicyTurn(
      turn,
      decision,
      operation,
      requestContext,
      () =>
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
        }),
    )
  }

  private async persistAutomaticPolicyTurn(
    turn: ActiveGroundedTurn,
    decision: OutputPolicyDecision,
    operation: OrchestrationContext,
    requestContext: AuditRequestContext | undefined,
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
        return this.createPolicyReviewAndPresent(
          turn.studentMessage,
          completed.message,
          decision,
          operation,
          requestContext,
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
    requestContext?: AuditRequestContext,
  ): Promise<GroundedChatTurnResponseDto> {
    const reasons = decodeAutomaticPolicyReasons(assistantMessage.errorCode)
    if (reasons !== null) {
      const decision = this.recreatePolicyDecision(assistantMessage, reasons)
      return this.createPolicyReviewAndPresent(
        studentMessage,
        assistantMessage,
        decision,
        operation,
        requestContext,
      )
    }
    return this.presentTurn(studentMessage, assistantMessage)
  }

  private recreatePolicyDecision(
    message: ChatMessageRecord,
    reasons: readonly AutomaticPolicyReason[],
  ): OutputPolicyDecision {
    const evidence = policyEvidenceFrom(message)
    return this.outputPolicy.evaluate({
      proposedContent: message.content,
      ...(message.content === OUTPUT_POLICY_QUESTION_X_SCHEDULE_CONFLICT_CONTENT
        ? { controlledConflictKind: 'QUESTION_X_SCHEDULE' }
        : {}),
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

  private async createPolicyReview(
    message: ChatMessageRecord,
    decision: OutputPolicyDecision,
    operation: OrchestrationContext,
    requestContext?: AuditRequestContext,
  ): Promise<void> {
    try {
      await this.outputPolicyReviewAdapter.createRequiredReview({
        assistantMessageId: message.id,
        decision,
        requestContext,
      })
    } catch (error) {
      this.logFailure('review_creation', operation, error)
      throw studentChatTerminalStateUnavailableException()
    }
  }

  private async createPolicyReviewAndPresent(
    studentMessage: ChatMessageRecord,
    assistantMessage: ChatMessageRecord,
    decision: OutputPolicyDecision,
    operation: OrchestrationContext,
    requestContext?: AuditRequestContext,
  ): Promise<GroundedChatTurnResponseDto> {
    if (decision.createReview) {
      await this.createPolicyReview(
        assistantMessage,
        decision,
        operation,
        requestContext,
      )
    }
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

function toCompletionContext(
  chunks: readonly RetrievedChunk[],
): NonEmptyCompletionContext | null {
  const first = chunks.at(0)
  if (first === undefined) {
    return null
  }

  return [toContextEntry(first), ...chunks.slice(1).map(toContextEntry)]
}

function toContextEntry(chunk: RetrievedChunk) {
  return {
    sourceTitle: chunk.materialTitle,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
  }
}

function safeErrorDescriptor(error: unknown): {
  errorClass: string
  errorCode?: string
} {
  if (error instanceof CompletionProviderError) {
    return {
      errorClass: 'CompletionProviderError',
      errorCode: error.code,
    }
  }
  if (error instanceof GroundedChatEvidenceUnavailableError) {
    return { errorClass: 'GroundedChatEvidenceUnavailableError' }
  }
  if (error instanceof OutputPolicyReviewIntegrationError) {
    return { errorClass: 'OutputPolicyReviewIntegrationError' }
  }
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

function hasDistinctCitation(evidence: readonly RetrievedChunk[]): boolean {
  return evidence.some((chunk) => chunk.materialId.trim() !== '')
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

function requireSingleEmbeddingModel(
  sources: ControlledSourceConflict['sources'],
): string {
  const models = new Set(sources.map(({ embeddingModel }) => embeddingModel))
  if (models.size !== 1) {
    throw new TypeError('Conflict sources must share one embedding profile')
  }
  return sources[0].embeddingModel
}

function isSafePrismaCode(code: string): boolean {
  return /^P\d{4}$/u.test(code)
}

function assertNever(_value: never): never {
  throw new Error('Unhandled grounded chat result')
}
