import { Injectable } from '@nestjs/common'

import {
  ExplanationDetailLevel,
  normalizeExplanationDetailLevel,
  StudentActionPurpose,
  TeachingTechnique,
} from '../../tutoring-values'
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

export const SAFE_FALLBACK_PROMPT_VERSION = 'safe-fallback.mvp.v3'

export const SAFE_FALLBACK_REASON = {
  VALIDATION_EXHAUSTED: 'VALIDATION_EXHAUSTED',
  GUARD_UNAVAILABLE: 'GUARD_UNAVAILABLE',
  GENERATION_RETRY_FAILED: 'GENERATION_RETRY_FAILED',
} as const

export type SafeFallbackReason =
  (typeof SAFE_FALLBACK_REASON)[keyof typeof SAFE_FALLBACK_REASON]

@Injectable()
export class SafeFallbackService {
  create(
    decision: PersistedTeachingDecisionRecord,
    detailLevel: ExplanationDetailLevel = ExplanationDetailLevel.STANDARD,
  ): ApprovedResponse {
    const studentActionObligation =
      studentActionObligationFromDecision(decision)
    const fallbackObligation = conservativeFallbackObligation(
      studentActionObligation,
    )
    const level = normalizeExplanationDetailLevel(detailLevel)

    return Object.freeze({
      message: fallbackMessage(fallbackObligation, level),
      responseIntent: decision.strategy,
      usedCitationIds: Object.freeze([]),
      requiresStudentAction: fallbackObligation.required,
      studentAction: Object.freeze({
        type: fallbackObligation.technique,
        description: fallbackActionDescription(fallbackObligation),
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

function fallbackMessage(
  obligation: StudentActionObligation,
  level: ExplanationDetailLevel = ExplanationDetailLevel.STANDARD,
): string {
  const technique = obligation.technique
  const purpose = obligation.purpose

  if (technique === TeachingTechnique.VERIFICATION) {
    if (level === ExplanationDetailLevel.CONCISE) {
      return 'Before relying on this step, what rule or calculation would you use to check it?'
    }
    if (level === ExplanationDetailLevel.DETAILED) {
      return 'Let us verify the last step before relying on it. Which rule applies here, and what calculation or trace would check the result?'
    }
    return 'Let us verify the last step before relying on it. What calculation or rule would you use to check the result?'
  }

  if (purpose === StudentActionPurpose.CONCEPTUAL_UNDERSTANDING) {
    if (level === ExplanationDetailLevel.CONCISE) {
      return 'Let us focus on the core concept. How would you describe what this concept does?'
    }
    if (level === ExplanationDetailLevel.DETAILED) {
      return 'Let us break down the underlying concept together. In your own words, what is the main purpose of this concept and how does it work?'
    }
    return 'Let us explore the core concept. How would you explain what this concept does in your own words?'
  }

  if (purpose === StudentActionPurpose.PRIOR_ATTEMPT_ORIENTATION) {
    if (level === ExplanationDetailLevel.CONCISE) {
      return 'Let us check your reasoning. What is the first value or operation you considered?'
    }
    if (level === ExplanationDetailLevel.DETAILED) {
      return 'Let us look closely at your reasoning step by step. What was the first value or operation you considered, and why?'
    }
    return 'Let us check your reasoning. What was the first step you considered?'
  }

  if (technique === TeachingTechnique.TRACE_EXECUTION) {
    if (level === ExplanationDetailLevel.CONCISE) {
      return 'Let us narrow it to one trace step. What value changes first?'
    }
    if (level === ExplanationDetailLevel.DETAILED) {
      return 'Let us trace the execution carefully step by step. What value changes first, and what did you expect it to become at that point?'
    }
    return 'Let us narrow it to one trace step. What value changes first, and what did you expect it to become?'
  }

  if (technique === TeachingTechnique.SELF_EXPLANATION) {
    if (level === ExplanationDetailLevel.CONCISE) {
      return 'In your own words, what part are you most confident about so far?'
    }
    if (level === ExplanationDetailLevel.DETAILED) {
      return 'Let us pause to review your reasoning step by step. In your own words, what part of your approach are you most confident about so far?'
    }
    return 'Let us pause at one step. In your own words, what part are you most confident about so far?'
  }

  if (level === ExplanationDetailLevel.CONCISE) {
    return 'Let us break this down. What is the starting value or condition to check first?'
  }
  if (level === ExplanationDetailLevel.DETAILED) {
    return 'Let us break this problem down into smaller steps. What is the starting value or condition you should look at first?'
  }
  return 'Let us break this down into one step. What is the first value or condition to check?'
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

function conservativeFallbackObligation(
  obligation: StudentActionObligation,
): StudentActionObligation {
  if (obligation.required) {
    return obligation
  }

  return Object.freeze({
    ...obligation,
    required: true,
    generationInstruction:
      'Ask for one lightweight verification because fallback cannot establish correctness or completion.',
  })
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
