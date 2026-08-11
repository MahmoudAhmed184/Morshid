import { Injectable, Logger } from '@nestjs/common'

import { assertRequestBudget } from '../../../common/http/request-deadline'
import { TutoringAttemptStatus } from '../tutoring-values'
import { CourseEvidence } from '../../materials/materials.public'
import { TutoringTurnRepository } from '../attempt/tutoring-turn.repository'
import { TopicService } from './topic.service'
import { TopicStateService } from './topic-state.service'
import { ContextManager } from './context-manager.service'
import { classifiedResponseFor } from './classified-response'
import {
  buildClassifiedTopicStateTransition,
  buildCompletedTopicStateTransition,
} from './topic-state-transition'
import { EducationalAnalysisService } from './educational-analysis.service'
import { TeachingPolicyEngine } from './teaching-policy.engine'
import {
  ResponseApprovalService,
  type ResponseApprovalLifecycle,
} from './response-approval.service'
import { CLASSIFIED_RESPONSE_POLICY_VERSION } from './classified-response'
import { TOPIC_RESOLUTION_OUTCOME } from './topic.types'
import {
  RetrievalQueryBuilder,
  retrievalQueryContextFromAnalysis,
} from './retrieval-query.builder'
import { AutomaticSafetyRiskDetector } from '../response-governance/automatic-safety-risk.detector'
import { ControlledSourceConflictDetector } from '../response-governance/controlled-source-conflict.detector'
import type {
  SocraticWorkflowInput,
  SocraticWorkflowResult,
} from './socratic-workflow.types'

/**
 * Private workflow implementation behind the TutoringRuntime boundary.
 *
 * Owns the full lifecycle:
 *   TutoringAttempt → Topic → TopicState → EducationalAnalysis → TeachingDecision
 *   → RetrievalQueryBuilder → course-scoped Retrieval
 *   → TutorGeneration + Validation → Approval
 *
 * Admission and terminal HTTP mapping remain outside this workflow.
 */
@Injectable()
export class SocraticWorkflow {
  private readonly logger = new Logger(SocraticWorkflow.name)

  constructor(
    private readonly turnRepository: TutoringTurnRepository,
    private readonly topicService: TopicService,
    private readonly topicStateService: TopicStateService,
    private readonly contextManager: ContextManager,
    private readonly educationalAnalysisService: EducationalAnalysisService,
    private readonly teachingPolicyEngine: TeachingPolicyEngine,
    private readonly responseApprovalService: ResponseApprovalService,
    private readonly retrievalQueryBuilder: RetrievalQueryBuilder,
    private readonly courseEvidence: CourseEvidence,
    private readonly safetyRiskDetector: AutomaticSafetyRiskDetector,
    private readonly conflictDetector: ControlledSourceConflictDetector,
  ) {}

  async run(input: SocraticWorkflowInput): Promise<SocraticWorkflowResult> {
    assertRequestBudget(input.requestBudget)
    const attemptId = input.attemptId
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
      return { kind: 'safety_refusal', detection: inputRisk, topicId: null }
    }

    try {
      return await this.runPipeline(input, attemptId)
    } catch (error) {
      this.logger.warn({
        event: 'tutoring_workflow_failed',
        attemptId,
        error: error instanceof Error ? error.message : 'UnknownError',
      })
      throw error
    }
  }

  /**
   * Execute the full Socratic pipeline within a structured try/catch so that
   * failures always mark the TutoringAttempt as FAILED before returning.
   */
  private async runPipeline(
    input: SocraticWorkflowInput,
    attemptId: string,
  ): Promise<SocraticWorkflowResult> {
    assertRequestBudget(input.requestBudget)
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
      return this.failTurn('SOCRATIC_TOPIC_UNRESOLVED')
    }
    const topicId = resolution.topicId

    // ── TopicState loading ────────────────────────────────────────
    const topicState = await this.topicStateService.getOrCreate(topicId)
    assertRequestBudget(input.requestBudget)

    // ── Phase 2: Educational Analysis ─────────────────────────────
    await this.advance(
      input,
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
      return this.failTurn('SOCRATIC_ANALYSIS_CONTEXT_UNAVAILABLE', topicId)
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
        `SOCRATIC_ANALYSIS_FAILED:${analysisResult.errorCode}`,
        topicId,
      )
    }

    assertRequestBudget(input.requestBudget)

    const classifiedResponse = classifiedResponseFor(
      analysisResult.analysis.result.requestKind,
    )
    if (classifiedResponse !== null) {
      return {
        kind: 'completed',
        completion: {
          kind: 'classified',
          content: classifiedResponse.content,
          requestKind: classifiedResponse.requestKind,
          guidanceLabel: classifiedResponse.guidanceLabel,
          errorCode: classifiedResponse.errorCode,
          promptVersion: CLASSIFIED_RESPONSE_POLICY_VERSION,
          topicId,
          topicStateTransition: buildClassifiedTopicStateTransition({
            topicState,
            requestKind: classifiedResponse.requestKind,
          }),
        },
      }
    }

    // ── Phase 3: Teaching Decision ────────────────────────────────
    await this.advance(
      input,
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
      return this.failTurn(
        `SOCRATIC_DECISION_FAILED:${decisionResult.errorCode}`,
        topicId,
      )
    }

    assertRequestBudget(input.requestBudget)

    // ── Course-scoped RAG Retrieval ───────────────────────────────
    await this.advance(
      input,
      TutoringAttemptStatus.DECIDING,
      TutoringAttemptStatus.RETRIEVING,
    )

    const retrievalRequest =
      input.debuggingGuidance === undefined
        ? this.retrievalQueryBuilder.build(
            retrievalQueryContextFromAnalysis(
              analysisContext,
              analysisResult.analysis,
            ),
          )
        : {
            query: input.debuggingGuidance.evidenceQuery,
            queryVersion: 'debugging-guidance.v1',
            contextMessageIds: [input.studentMessageId],
          }
    this.logger.debug({
      event: 'socratic_retrieval_query_built',
      attemptId,
      queryVersion: retrievalRequest.queryVersion,
      queryLength: retrievalRequest.query.length,
      contextualMessageCount: retrievalRequest.contextMessageIds.length,
    })
    const retrieval =
      input.requestBudget === undefined
        ? await this.courseEvidence.search(
            input.courseId,
            retrievalRequest.query,
          )
        : await this.courseEvidence.search(
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
      return { kind: 'blocked', reason, topicId }
    }

    const documentRisk = this.safetyRiskDetector.detectRetrievedDocuments(
      retrieval.chunks,
    )
    if (documentRisk !== null) {
      return { kind: 'safety_refusal', detection: documentRisk, topicId }
    }

    const conflict = this.conflictDetector.detect(
      input.studentMessageContent,
      retrieval.chunks,
    )
    if (conflict !== null) {
      return { kind: 'source_conflict', conflict, topicId }
    }

    // ── Phase 4 + 5: Generation, Validation, Approval ─────────────
    await this.advance(
      input,
      TutoringAttemptStatus.RETRIEVING,
      TutoringAttemptStatus.GENERATING,
    )

    const responseLifecycle = this.responseApprovalLifecycle(input)

    assertRequestBudget(input.requestBudget)
    const approval = await this.responseApprovalService.approve({
      courseId: input.courseId,
      sessionId: input.sessionId,
      studentId: input.studentId,
      attemptId,
      studentMessageId: input.studentMessageId,
      topicId,
      assistantMessageId: input.assistantMessageId,
      teachingDecision: decisionResult.decision,
      retrievalResult: retrieval.chunks,
      debuggingGuidance: input.debuggingGuidance,
      lifecycle: responseLifecycle,
      ...(input.requestBudget === undefined
        ? {}
        : {
            signal: input.requestBudget.signal,
            deadlineAt: input.requestBudget.deadlineAt,
          }),
    })
    if (!approval.success) {
      if ('outputRisk' in approval && approval.outputRisk !== undefined) {
        return {
          kind: 'safety_refusal',
          detection: approval.outputRisk,
          topicId,
        }
      }
      return this.failTurn(
        `SOCRATIC_APPROVAL_FAILED:${approval.errorCode}`,
        topicId,
      )
    }

    const outputRisk = this.safetyRiskDetector.detectOutput(
      approval.approvedResponse.message,
      true,
    )
    if (outputRisk !== null) {
      return { kind: 'safety_refusal', detection: outputRisk, topicId }
    }

    const decision = decisionResult.decision
    return {
      kind: 'completed',
      completion: {
        kind: 'approved',
        approvedResponse: approval.approvedResponse,
        evidence: retrieval.chunks,
        requestKind: analysisResult.analysis.result.requestKind,
        topicId,
        guidanceLevel: decision.guidanceLevel,
        safeFallbackReason: approval.safeFallbackReason,
        auditGraph: approval.auditGraph,
        topicStateTransition: buildCompletedTopicStateTransition({
          topicState,
          analysis: analysisResult.analysis,
          decision,
          approvedResponse: approval.approvedResponse,
        }),
      },
    }
  }

  private failTurn(
    errorCode: string,
    topicId: string | null = null,
  ): SocraticWorkflowResult {
    return { kind: 'failed', errorCode, topicId }
  }

  private async advance(
    input: SocraticWorkflowInput,
    expectedStatus: TutoringAttemptStatus,
    nextStatus: TutoringAttemptStatus,
  ): Promise<void> {
    const advanced = await this.turnRepository.transitionAttempt({
      courseId: input.courseId,
      sessionId: input.sessionId,
      studentId: input.studentId,
      attemptId: input.attemptId,
      expectedStatus,
      nextStatus,
    })
    if (!advanced) {
      throw new Error(
        `Tutoring Attempt transition failed: ${expectedStatus} -> ${nextStatus}`,
      )
    }
  }

  private responseApprovalLifecycle(
    input: SocraticWorkflowInput,
  ): ResponseApprovalLifecycle {
    let status: TutoringAttemptStatus = TutoringAttemptStatus.GENERATING

    return {
      beginValidation: async () => {
        if (
          status !== TutoringAttemptStatus.GENERATING &&
          status !== TutoringAttemptStatus.REGENERATING
        ) {
          throw new Error(
            `Tutoring Attempt cannot enter validation from ${status}`,
          )
        }
        await this.advance(input, status, TutoringAttemptStatus.VALIDATING)
        status = TutoringAttemptStatus.VALIDATING
      },
      beginRegeneration: async () => {
        if (status !== TutoringAttemptStatus.VALIDATING) {
          throw new Error(
            `Tutoring Attempt cannot enter regeneration from ${status}`,
          )
        }
        await this.advance(
          input,
          TutoringAttemptStatus.VALIDATING,
          TutoringAttemptStatus.REGENERATING,
        )
        status = TutoringAttemptStatus.REGENERATING
      },
    }
  }
}
