import { Injectable } from '@nestjs/common'

import { citationIdForChunk } from './tutor-generation-context'
import { TutorGenerationService } from './tutor-generation.service'
import {
  TUTOR_GENERATION_FAILURE_CODE,
  type TutorGenerationInput,
} from './tutor-generation.types'
import {
  MAX_MVP_CANDIDATE_ATTEMPTS,
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
import type { PersistedTeachingDecisionRecord } from './teaching-decision.repository'
import { TeachingDecisionRepository } from './teaching-decision.repository'
import { TurnRepository } from './turn.repository'
import {
  type GuardResultAudit,
  type ResponseAuditGraph,
  type TutorCandidateAttemptAudit,
  failedCandidateAttemptAudit,
  generatedCandidateAttemptAudit,
  guardResultAudit,
} from './response-audit.types'

export interface ResponseApprovalInput extends TutorGenerationInput {
  readonly assistantMessageId?: string
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
      readonly errorCode:
        'MISSING_TEACHING_DECISION' | 'RESPONSE_APPROVAL_PERSISTENCE_FAILED'
    }

export type PersistedResponseApprovalResult =
  | Extract<ResponseApprovalResult, { success: true }>
  | {
      readonly success: false
      readonly errorCode:
        'MISSING_TEACHING_DECISION' | 'RESPONSE_APPROVAL_PERSISTENCE_FAILED'
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
    private readonly turnRepository: TurnRepository,
  ) {}

  async approve(input: ResponseApprovalInput): Promise<ResponseApprovalResult> {
    const decision = await this.teachingDecisionRepository.findByTurnId(
      input.turnId,
    )
    if (decision === null) {
      return { success: false, errorCode: 'MISSING_TEACHING_DECISION' }
    }

    const validationResults: ValidationResult[] = []
    const candidateAttemptAudits: TutorCandidateAttemptAudit[] = []
    const guardResultAudits: GuardResultAudit[] = []
    const context = buildCandidateValidationContext({
      allowedCitationIds: new Set(
        input.retrievalResult.map(citationIdForChunk),
      ),
      requireStudentAction: decision.requireStudentAction,
      reflectionMode: decision.reflectionMode,
      responseIntent: decision.strategy,
      primaryTechnique: decision.primaryTechnique,
      guidanceLevel: decision.guidanceLevel,
      revealPolicy: decision.revealPolicy,
      maximumDisclosedSteps: decision.guardPolicy.maximumDisclosedSteps,
    })

    let previousValidation: ValidationResult | null = null
    let candidateAttempts = 0
    for (let attempt = 1; attempt <= MAX_MVP_CANDIDATE_ATTEMPTS; attempt += 1) {
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
          }),
        )
        if (structuralFailure) {
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
            )
          }
          previousValidation = structural
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
        )
      }

      candidateAttemptAudits.push(
        generatedCandidateAttemptAudit({
          candidateAttempt: attempt,
          candidate: generation.candidate,
          startedAt: generationStartedAt,
          completedAt: generationCompletedAt,
        }),
      )

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
          )
        }
        previousValidation = structural
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
          )
        }
        previousValidation = deterministic
        continue
      }

      const semantic = await this.semanticGuard.evaluate({
        turnId: input.turnId,
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
      })
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
          )
        }
        previousValidation = semantic.result
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
    )
  }

  async approveAndPersist(
    input: ResponseApprovalInput & { readonly assistantMessageId: string },
  ): Promise<PersistedResponseApprovalResult> {
    const approval = await this.approve(input)
    if (!approval.success) {
      return approval
    }

    const decision = await this.teachingDecisionRepository.findByTurnId(
      input.turnId,
    )
    if (decision === null) {
      return { success: false, errorCode: 'MISSING_TEACHING_DECISION' }
    }

    const persisted = await this.turnRepository.completeApprovedResponse({
      courseId: input.courseId,
      sessionId: input.sessionId,
      studentId: input.studentId,
      turnId: input.turnId,
      topicId: input.topicId,
      studentMessageId: input.studentMessageId,
      assistantMessageId: input.assistantMessageId,
      approvedResponse: approval.approvedResponse,
      guidanceLevel: decision.guidanceLevel,
      retrievalResult: input.retrievalResult,
      auditGraph: approval.auditGraph,
      safeFallbackReason: approval.safeFallbackReason,
    })

    if (persisted.kind !== 'ok') {
      return {
        success: false,
        errorCode: 'RESPONSE_APPROVAL_PERSISTENCE_FAILED',
      }
    }

    return approval
  }
}

function approvalWithFallback(
  fallbackService: SafeFallbackService,
  decision: PersistedTeachingDecisionRecord,
  validationResults: readonly ValidationResult[],
  candidateAttempts: number,
  reason: SafeFallbackReason,
  candidateAttemptAudits: readonly TutorCandidateAttemptAudit[],
  guardResultAudits: readonly GuardResultAudit[],
): Extract<ResponseApprovalResult, { success: true }> {
  return {
    success: true,
    approvedResponse: fallbackService.create(decision, reason),
    validationResults: Object.freeze([...validationResults]),
    candidateAttempts,
    safeFallbackReason: reason,
    auditGraph: freezeAuditGraph(candidateAttemptAudits, guardResultAudits),
  }
}

function freezeAuditGraph(
  candidateAttempts: readonly TutorCandidateAttemptAudit[],
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
