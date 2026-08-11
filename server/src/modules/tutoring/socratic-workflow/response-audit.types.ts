import { createHash } from 'node:crypto'

import { TutoringCandidateGenerationOutcome } from '../tutoring-values'
import { SOCRATIC_DISCLOSURE_POLICY_VERSION } from './socratic-disclosure-policy'
import type { PersistedTeachingDecisionRecord } from './teaching-decision.repository'
import type { CandidateResponse } from './tutor-generation.types'
import type { ValidationResult } from './response-validation.types'

export interface TutoringCandidateAttemptAudit {
  readonly candidateAttempt: number
  readonly generationOutcome: TutoringCandidateGenerationOutcome
  readonly generationFailureCode: string | null
  readonly contentHash: string | null
  readonly provider: string | null
  readonly model: string | null
  readonly promptVersion: string | null
  readonly inputTokens: number | null
  readonly outputTokens: number | null
  readonly infrastructureRetryCount: number
  readonly startedAt: Date
  readonly completedAt: Date
}

export interface GuardResultAudit {
  readonly candidateAttempt: number
  readonly result: ValidationResult
  readonly teachingPolicyVersion: string
  readonly disclosurePolicyVersion: string
}

export interface ResponseAuditGraph {
  readonly candidateAttempts: readonly TutoringCandidateAttemptAudit[]
  readonly guardResults: readonly GuardResultAudit[]
}

export function generatedCandidateAttemptAudit(input: {
  candidateAttempt: number
  candidate: CandidateResponse
  startedAt: Date
  completedAt: Date
  infrastructureRetryCount?: number
}): TutoringCandidateAttemptAudit {
  return Object.freeze({
    candidateAttempt: input.candidateAttempt,
    generationOutcome: TutoringCandidateGenerationOutcome.GENERATED,
    generationFailureCode: null,
    contentHash: hashCandidate(input.candidate),
    provider: input.candidate.provider,
    model: input.candidate.model,
    promptVersion: input.candidate.promptVersion,
    inputTokens: input.candidate.tokenUsage.input,
    outputTokens: input.candidate.tokenUsage.output,
    infrastructureRetryCount: input.infrastructureRetryCount ?? 0,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  })
}

export function failedCandidateAttemptAudit(input: {
  candidateAttempt: number
  errorCode: string
  invalidOutput: boolean
  startedAt: Date
  completedAt: Date
  infrastructureRetryCount?: number
}): TutoringCandidateAttemptAudit {
  return Object.freeze({
    candidateAttempt: input.candidateAttempt,
    generationOutcome: input.invalidOutput
      ? TutoringCandidateGenerationOutcome.INVALID_OUTPUT
      : TutoringCandidateGenerationOutcome.INFRASTRUCTURE_EXHAUSTED,
    generationFailureCode: input.errorCode,
    contentHash: null,
    provider: null,
    model: null,
    promptVersion: null,
    inputTokens: null,
    outputTokens: null,
    infrastructureRetryCount: input.infrastructureRetryCount ?? 0,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  })
}

export function guardResultAudit(
  candidateAttempt: number,
  result: ValidationResult,
  decision: PersistedTeachingDecisionRecord,
): GuardResultAudit {
  return Object.freeze({
    candidateAttempt,
    result,
    teachingPolicyVersion: decision.policyVersion,
    disclosurePolicyVersion: SOCRATIC_DISCLOSURE_POLICY_VERSION,
  })
}

function hashCandidate(candidate: CandidateResponse): string {
  const canonical = JSON.stringify({
    message: candidate.message,
    responseIntent: candidate.responseIntent,
    usedCitationIds: candidate.usedCitationIds,
    requiresStudentAction: candidate.requiresStudentAction,
    studentAction: candidate.studentAction,
    reflectionIncluded: candidate.reflectionIncluded,
    selfReportedCompliance: candidate.selfReportedCompliance,
    provider: candidate.provider,
    model: candidate.model,
    promptVersion: candidate.promptVersion,
    tokenUsage: candidate.tokenUsage,
  })

  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}
