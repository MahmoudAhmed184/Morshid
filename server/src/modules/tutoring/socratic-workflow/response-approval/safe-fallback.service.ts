import { Injectable } from '@nestjs/common'

import { StudentActionPurpose, TeachingTechnique } from '../../tutoring-values'
import {
  APPROVED_RESPONSE_SOURCE,
  MVP_RESPONSE_VALIDATION_POLICY_VERSION,
  type ApprovedResponse,
} from './response-validation.types'
import type { PersistedTeachingDecisionRecord } from '../teaching-decision/teaching-decision.repository'
import type { CandidateResponse } from '../generation/tutor-generation.types'
import {
  studentActionObligationFromDecision,
  type StudentActionObligation,
} from '../teaching-decision/student-action-obligation'

export const SAFE_FALLBACK_PROMPT_VERSION = 'safe-fallback.mvp.v2'

export const SAFE_FALLBACK_REASON = {
  VALIDATION_EXHAUSTED: 'VALIDATION_EXHAUSTED',
  GUARD_UNAVAILABLE: 'GUARD_UNAVAILABLE',
  GENERATION_RETRY_FAILED: 'GENERATION_RETRY_FAILED',
} as const

export type SafeFallbackReason =
  (typeof SAFE_FALLBACK_REASON)[keyof typeof SAFE_FALLBACK_REASON]

@Injectable()
export class SafeFallbackService {
  create(decision: PersistedTeachingDecisionRecord): ApprovedResponse {
    const studentActionObligation =
      studentActionObligationFromDecision(decision)

    return Object.freeze({
      message: fallbackMessage(studentActionObligation),
      responseIntent: decision.strategy,
      usedCitationIds: Object.freeze([]),
      requiresStudentAction: studentActionObligation.required,
      studentAction: Object.freeze({
        type: studentActionObligation.technique,
        description: fallbackActionDescription(studentActionObligation),
      }),
      reflectionIncluded: false,
      source: APPROVED_RESPONSE_SOURCE.SAFE_FALLBACK,
      approvedCandidateAttempt: null,
      safeFallbackUsed: true,
      approvalMetadata: Object.freeze({
        provider: null,
        model: null,
        promptVersion: SAFE_FALLBACK_PROMPT_VERSION,
        inputTokens: 0,
        outputTokens: 0,
        validationPolicyVersion: MVP_RESPONSE_VALIDATION_POLICY_VERSION,
        structuralApproved: false,
        deterministicApproved: false,
        semanticApproved: null,
      }),
    })
  }
}

function fallbackMessage(obligation: StudentActionObligation): string {
  const technique = obligation.technique

  if (technique === TeachingTechnique.TRACE_EXECUTION) {
    return 'Let us narrow it to one trace step. What value changes first, and what did you expect it to become?'
  }

  if (technique === TeachingTechnique.SELF_EXPLANATION) {
    return 'Let us pause at one step. In your own words, what part are you most confident about so far?'
  }

  return 'Let us narrow it down to one step. Show the last step you were confident about and what you expected next.'
}

function fallbackActionDescription(
  obligation: StudentActionObligation,
): string {
  switch (obligation.purpose) {
    case StudentActionPurpose.PRIOR_ATTEMPT_ORIENTATION:
      return 'Ask the student to describe what they tried as one action.'
    case StudentActionPurpose.CONCEPTUAL_UNDERSTANDING:
      return 'Ask one meaningful conceptual understanding question.'
    case StudentActionPurpose.PRIMARY_TECHNIQUE:
      return `Ask one meaningful ${obligation.technique} reasoning question.`
  }
}

export function approvedResponseFromCandidate(input: {
  readonly candidate: CandidateResponse
  readonly attempt: number
  readonly semanticApproved: boolean
}): ApprovedResponse {
  const { candidate } = input
  return Object.freeze({
    message: candidate.message,
    responseIntent: candidate.responseIntent,
    usedCitationIds: Object.freeze([...candidate.usedCitationIds]),
    requiresStudentAction: candidate.requiresStudentAction,
    studentAction: candidate.studentAction,
    reflectionIncluded: candidate.reflectionIncluded,
    source: APPROVED_RESPONSE_SOURCE.VALIDATED_CANDIDATE,
    approvedCandidateAttempt: input.attempt,
    safeFallbackUsed: false,
    approvalMetadata: Object.freeze({
      provider: candidate.provider,
      model: candidate.model,
      promptVersion: candidate.promptVersion,
      inputTokens: candidate.tokenUsage.input,
      outputTokens: candidate.tokenUsage.output,
      validationPolicyVersion: MVP_RESPONSE_VALIDATION_POLICY_VERSION,
      structuralApproved: true,
      deterministicApproved: true,
      semanticApproved: input.semanticApproved,
    }),
  })
}
