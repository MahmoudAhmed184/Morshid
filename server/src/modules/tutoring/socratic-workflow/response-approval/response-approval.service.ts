import { Injectable } from '@nestjs/common'

import { assertRequestBudget } from '../../../../common/http/request-deadline'
import { ExplanationDetailLevel, TeachingStrategy } from '../../tutoring-values'

import { citationIdForChunk } from '../generation/tutor-generation-context'
import { TutorGenerationService } from '../generation/tutor-generation.service'
import {
  TUTOR_GENERATION_FAILURE_CODE,
  type TutorGenerationInput,
} from '../generation/tutor-generation.types'
import {
  MAX_MVP_CANDIDATE_ATTEMPTS,
  RESPONSE_VIOLATION_TYPE,
  type ApprovedResponse,
  type ValidationResult,
} from './response-validation.types'
import {
  StructuralResponseValidator,
  buildCandidateValidationContext,
  structuralRejectionFromGenerationFailure,
} from './structural-response.validator'
import { DeterministicGuardService } from './deterministic-guard.service'
import { SemanticGuardService } from './semantic-guard.service'
import {
  SAFE_FALLBACK_REASON,
  SafeFallbackService,
  type SafeFallbackReason,
  approvedResponseFromCandidate,
} from './safe-fallback.service'
import type { PersistedTeachingDecisionRecord } from '../teaching-decision/teaching-decision.repository'
import { TeachingDecisionRepository } from '../teaching-decision/teaching-decision.repository'
import {
  type GuardResultAudit,
  type ResponseAuditGraph,
  type TutoringCandidateAttemptAudit,
  failedCandidateAttemptAudit,
  generatedCandidateAttemptAudit,
  guardResultAudit,
} from './response-audit.types'

import {
  AutomaticSafetyRiskDetector,
  type AutomaticSafetyRiskDetection,
} from '../../response-governance/automatic-safety-risk.detector'

export interface ResponseApprovalInput extends TutorGenerationInput {
  readonly assistantMessageId?: string
  readonly teachingDecision?: PersistedTeachingDecisionRecord
  readonly lifecycle?: ResponseApprovalLifecycle
}

export interface ResponseApprovalLifecycle {
  beginValidation(): Promise<void>
  beginRegeneration(): Promise<void>
}

export type ResponseApprovalResult =
  | {
      readonly success: true
      readonly approvedResponse: ApprovedResponse
      readonly validationResults: readonly ValidationResult[]
      readonly candidateAttempts: number
      readonly safeFallbackReason: SafeFallbackReason | null
      readonly auditGraph: ResponseAuditGraph
    }
  | {
      readonly success: false
      readonly outputRisk?: AutomaticSafetyRiskDetection
      readonly errorCode:
        | 'MISSING_TEACHING_DECISION'
        | 'RESPONSE_APPROVAL_PERSISTENCE_FAILED'
        | 'SAFETY_RISK_DETECTED'
    }

@Injectable()
export class ResponseApprovalService {
  constructor(
    private readonly tutorGenerationService: TutorGenerationService,
    private readonly teachingDecisionRepository: TeachingDecisionRepository,
    private readonly structuralValidator: StructuralResponseValidator,
    private readonly deterministicGuard: DeterministicGuardService,
    private readonly semanticGuard: SemanticGuardService,
    private readonly safeFallbackService: SafeFallbackService,
    private readonly safetyRiskDetector: AutomaticSafetyRiskDetector,
  ) {}

  approve(input: ResponseApprovalInput): Promise<ResponseApprovalResult> {
    return this.approveWithLifecycle(input)
  }

  private async approveWithLifecycle(
    input: ResponseApprovalInput,
  ): Promise<ResponseApprovalResult> {
    assertRequestBudget(input)
    const decision =
      input.teachingDecision ??
      (await this.teachingDecisionRepository.findByTurnId(input.attemptId))
    if (decision === null) {
      return { success: false, errorCode: 'MISSING_TEACHING_DECISION' }
    }

    const validationResults: ValidationResult[] = []
    const candidateAttemptAudits: TutoringCandidateAttemptAudit[] = []
    const guardResultAudits: GuardResultAudit[] = []
    const context = buildCandidateValidationContext({
      allowedCitationIds: new Set(
        input.retrievalResult.map(citationIdForChunk),
      ),
      requireGrounding: decision.guardPolicy.requireGrounding,
      enforceCitationSupport: decision.guardPolicy.enforceCitationSupport,
      requireStudentAction: decision.requireStudentAction,
      reflectionMode: decision.reflectionMode,
      responseIntent: decision.strategy,
      primaryTechnique: decision.primaryTechnique,
      guidanceLevel: decision.guidanceLevel,
      revealPolicy: decision.revealPolicy,
      maximumDisclosedSteps: decision.guardPolicy.maximumDisclosedSteps,
      debuggingGuidance: input.debuggingGuidance,
      debuggingGuidanceRequired:
        input.debuggingGuidance !== undefined ||
        decision.strategy === TeachingStrategy.DEBUGGING_GUIDANCE,
    })

    let previousValidation: ValidationResult | null = null
    let candidateAttempts = 0
    for (let attempt = 1; attempt <= MAX_MVP_CANDIDATE_ATTEMPTS; attempt += 1) {
      assertRequestBudget(input)
      candidateAttempts = attempt
      const generationStartedAt = new Date()
      const generation = await this.tutorGenerationService.generate({
        ...input,
        ...(previousValidation === null
          ? {}
          : {
              regeneration: {
                promptVersion: 'tutor-regeneration.mvp.v1',
                candidateAttempt: attempt,
                previousValidation,
                authoritativePolicy: {
                  teachingDecisionId: decision.id,
                  policyVersion: decision.policyVersion,
                  guidanceLevel: decision.guidanceLevel,
                  revealPolicy: decision.revealPolicy,
                  guardPolicy: decision.guardPolicy,
                },
              },
            }),
      })
      assertRequestBudget(input)
      const generationCompletedAt = new Date()

      if (!generation.success) {
        const structuralFailure = isStructuralGenerationFailure(
          generation.errorCode,
        )
        candidateAttemptAudits.push(
          failedCandidateAttemptAudit({
            candidateAttempt: attempt,
            errorCode: generation.errorCode,
            invalidOutput: structuralFailure,
            startedAt: generationStartedAt,
            completedAt: generationCompletedAt,
            infrastructureRetryCount: generation.infrastructureRetryCount,
          }),
        )
        if (structuralFailure) {
          await input.lifecycle?.beginValidation()
          const structural = structuralRejectionFromGenerationFailure(
            generation.errorCode,
          )
          validationResults.push(structural)
          guardResultAudits.push(
            guardResultAudit(attempt, structural, decision),
          )
          if (attempt === MAX_MVP_CANDIDATE_ATTEMPTS) {
            return approvalWithFallback(
              this.safeFallbackService,
              decision,
              validationResults,
              candidateAttempts,
              SAFE_FALLBACK_REASON.VALIDATION_EXHAUSTED,
              candidateAttemptAudits,
              guardResultAudits,
              input.explanationDetailLevel,
            )
          }
          previousValidation = structural
          await input.lifecycle?.beginRegeneration()
          continue
        }

        return approvalWithFallback(
          this.safeFallbackService,
          decision,
          validationResults,
          candidateAttempts,
          SAFE_FALLBACK_REASON.GENERATION_RETRY_FAILED,
          candidateAttemptAudits,
          guardResultAudits,
          input.explanationDetailLevel,
        )
      }

      candidateAttemptAudits.push(
        generatedCandidateAttemptAudit({
          candidateAttempt: attempt,
          candidate: generation.candidate,
          startedAt: generationStartedAt,
          completedAt: generationCompletedAt,
          infrastructureRetryCount: generation.infrastructureRetryCount,
        }),
      )

      const outputRisk = this.safetyRiskDetector.detectOutput(
        generation.candidate.message,
        true,
      )
      if (outputRisk !== null) {
        return {
          success: false,
          outputRisk,
          errorCode: 'SAFETY_RISK_DETECTED',
        }
      }

      await input.lifecycle?.beginValidation()
      const structural = this.structuralValidator.validate(
        generation.candidate,
        context,
      )
      validationResults.push(structural)
      guardResultAudits.push(guardResultAudit(attempt, structural, decision))
      if (!structural.approved) {
        if (attempt === MAX_MVP_CANDIDATE_ATTEMPTS) {
          return approvalWithFallback(
            this.safeFallbackService,
            decision,
            validationResults,
            candidateAttempts,
            SAFE_FALLBACK_REASON.VALIDATION_EXHAUSTED,
            candidateAttemptAudits,
            guardResultAudits,
            input.explanationDetailLevel,
          )
        }
        previousValidation = structural
        await input.lifecycle?.beginRegeneration()
        continue
      }

      const deterministic = this.deterministicGuard.evaluate(
        generation.candidate,
        context,
      )
      validationResults.push(deterministic)
      guardResultAudits.push(guardResultAudit(attempt, deterministic, decision))
      if (!deterministic.approved) {
        if (attempt === MAX_MVP_CANDIDATE_ATTEMPTS) {
          return approvalWithFallback(
            this.safeFallbackService,
            decision,
            validationResults,
            candidateAttempts,
            SAFE_FALLBACK_REASON.VALIDATION_EXHAUSTED,
            candidateAttemptAudits,
            guardResultAudits,
            input.explanationDetailLevel,
          )
        }
        previousValidation = deterministic
        await input.lifecycle?.beginRegeneration()
        continue
      }

      const semantic = await this.semanticGuard.evaluate({
        attemptId: input.attemptId,
        topicId: input.topicId,
        courseId: input.courseId,
        candidateAttempt: attempt,
        candidate: generation.candidate,
        educationalContext: generation.educationalContext,
        validationContext: context,
        guardPolicy: decision.guardPolicy,
        allowedCitationSummaries: input.retrievalResult.map((chunk) => ({
          citationId: citationIdForChunk(chunk),
          chunkId: chunk.chunkId,
          materialId: chunk.materialId,
          materialTitle: chunk.materialTitle,
          chunkIndex: chunk.chunkIndex,
          rank: chunk.rank,
          content: chunk.content,
        })),
        ...(input.signal === undefined ? {} : { signal: input.signal }),
        ...(input.deadlineAt === undefined
          ? {}
          : { deadlineAt: input.deadlineAt }),
      })
      assertRequestBudget(input)
      validationResults.push(semantic.result)
      guardResultAudits.push(
        guardResultAudit(attempt, semantic.result, decision),
      )
      if (semantic.kind === 'infrastructure_failure') {
        return approvalWithFallback(
          this.safeFallbackService,
          decision,
          validationResults,
          candidateAttempts,
          SAFE_FALLBACK_REASON.GUARD_UNAVAILABLE,
          candidateAttemptAudits,
          guardResultAudits,
          input.explanationDetailLevel,
        )
      }
      if (!semantic.result.approved) {
        if (attempt === MAX_MVP_CANDIDATE_ATTEMPTS) {
          return approvalWithFallback(
            this.safeFallbackService,
            decision,
            validationResults,
            candidateAttempts,
            SAFE_FALLBACK_REASON.VALIDATION_EXHAUSTED,
            candidateAttemptAudits,
            guardResultAudits,
            input.explanationDetailLevel,
          )
        }
        previousValidation = semantic.result
        await input.lifecycle?.beginRegeneration()
        continue
      }

      return {
        success: true,
        approvedResponse: approvedResponseFromCandidate({
          candidate: generation.candidate,
          attempt,
          semanticApproved: true,
        }),
        validationResults: Object.freeze(validationResults),
        candidateAttempts,
        safeFallbackReason: null,
        auditGraph: freezeAuditGraph(candidateAttemptAudits, guardResultAudits),
      }
    }

    return approvalWithFallback(
      this.safeFallbackService,
      decision,
      validationResults,
      candidateAttempts,
      SAFE_FALLBACK_REASON.VALIDATION_EXHAUSTED,
      candidateAttemptAudits,
      guardResultAudits,
      input.explanationDetailLevel,
    )
  }
}

function approvalWithFallback(
  fallbackService: SafeFallbackService,
  decision: PersistedTeachingDecisionRecord,
  validationResults: readonly ValidationResult[],
  candidateAttempts: number,
  reason: SafeFallbackReason,
  candidateAttemptAudits: readonly TutoringCandidateAttemptAudit[],
  guardResultAudits: readonly GuardResultAudit[],
  detailLevel?: ExplanationDetailLevel,
): ResponseApprovalResult {
  const hasFinalAnswerRisk = validationResults.some((result) =>
    result.violations.some(
      (v) =>
        v.type === RESPONSE_VIOLATION_TYPE.FINAL_ANSWER_DISCLOSURE ||
        v.type === RESPONSE_VIOLATION_TYPE.COMPLETE_SOLUTION_DISCLOSURE ||
        v.type === RESPONSE_VIOLATION_TYPE.SUBMISSION_READY_CODE,
    ),
  )
  if (hasFinalAnswerRisk) {
    return {
      success: false,
      outputRisk: {
        detectorVersion: 'automatic-safety-risk-v3',
        risks: ['FINAL_ANSWER_DELIVERY'],
      },
      errorCode: 'SAFETY_RISK_DETECTED',
    }
  }

  return {
    success: true,
    approvedResponse: fallbackService.create(decision, detailLevel),
    validationResults: Object.freeze([...validationResults]),
    candidateAttempts,
    safeFallbackReason: reason,
    auditGraph: freezeAuditGraph(candidateAttemptAudits, guardResultAudits),
  }
}

function freezeAuditGraph(
  candidateAttempts: readonly TutoringCandidateAttemptAudit[],
  guardResults: readonly GuardResultAudit[],
): ResponseAuditGraph {
  return Object.freeze({
    candidateAttempts: Object.freeze([...candidateAttempts]),
    guardResults: Object.freeze([...guardResults]),
  })
}

function isStructuralGenerationFailure(errorCode: string): boolean {
  return (
    errorCode === TUTOR_GENERATION_FAILURE_CODE.TUTOR_MALFORMED_OUTPUT ||
    errorCode === TUTOR_GENERATION_FAILURE_CODE.TUTOR_INVALID_OUTPUT ||
    errorCode === TUTOR_GENERATION_FAILURE_CODE.TUTOR_INVALID_CITATION
  )
}
