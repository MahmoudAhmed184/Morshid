import type { MessageGuidanceLabel } from '../tutoring-values'
import type { ReviewTriggerType } from '../../reviews/interface/review-values'
import type { AutomaticReviewEvidenceInput } from '../../reviews/interface/review-case-intake'

export const RESPONSE_GOVERNANCE_VERSION = 'response-governance-v1'

export const AUTOMATIC_POLICY_REASONS = [
  'GENERAL_NOT_FOUND',
  'SOURCE_CONFLICT',
  'POLICY_CHECK_FAILED',
  'FINAL_ANSWER_RISK',
  'CITATION_MISSING',
] as const satisfies readonly Exclude<ReviewTriggerType, 'STUDENT_REQUEST'>[]

export type AutomaticPolicyReason = (typeof AUTOMATIC_POLICY_REASONS)[number]

export function encodeAutomaticPolicyReasons(
  reasons: readonly AutomaticPolicyReason[],
): string {
  if (reasons.length === 0) {
    throw new TypeError('Automatic policy reason code cannot be empty')
  }
  const detected = new Set(reasons)
  return AUTOMATIC_POLICY_REASONS.filter((reason) => detected.has(reason)).join(
    '+',
  )
}

export function decodeAutomaticPolicyReasons(
  value: string | null,
): readonly AutomaticPolicyReason[] | null {
  if (value === null || value.length === 0) {
    return null
  }
  const parts = value.split('+')
  if (
    parts.some(
      (part) =>
        !AUTOMATIC_POLICY_REASONS.includes(part as AutomaticPolicyReason),
    )
  ) {
    return null
  }
  const reasons = AUTOMATIC_POLICY_REASONS.filter((reason) =>
    parts.includes(reason),
  )
  return encodeAutomaticPolicyReasons(reasons) === value ? reasons : null
}

export type ResponseGovernanceSupport =
  'SUPPORTED' | 'NOT_FOUND' | 'CONFLICTING'
export type ResponseGovernanceCheck = 'PASSED' | 'FAILED'
export type ResponseGovernanceAnswerRisk = 'NONE' | 'FINAL_ANSWER'
export type ResponseGovernanceCitationState =
  'PRESENT' | 'MISSING' | 'NOT_REQUIRED'

export interface ResponseGovernanceAssessment {
  readonly support: ResponseGovernanceSupport
  readonly policyCheck: ResponseGovernanceCheck
  readonly answerRisk: ResponseGovernanceAnswerRisk
  readonly citations: ResponseGovernanceCitationState
}

export interface ResponseGovernanceEvidenceSource {
  readonly materialId?: string
  readonly materialTitle?: string
  readonly chunkId?: string
  readonly chunkIndex?: number
  readonly excerpt: string
  readonly rank?: number
  readonly score?: number
}

export interface ResponseGovernanceInput {
  readonly proposedContent: string
  readonly assessment: ResponseGovernanceAssessment
  readonly controlledConflictKind?: ResponseGovernanceConflictKind
  readonly evidence?: readonly ResponseGovernanceEvidenceSource[]
  readonly reviewFacts?: readonly ResponseGovernanceReviewFact[]
}

export type ResponseGovernanceConflictKind =
  'PYTHON_DIVISION' | 'QUESTION_X_SCHEDULE'

export interface ResponseGovernanceReviewFact {
  readonly code: 'detector_version' | 'embedding_model'
  readonly value: string
}

export type ResponseGovernanceDisplay = 'AS_PROPOSED' | 'SAFE_REPLACEMENT'
export type StudentVisibleReviewStatus = 'NOT_REQUIRED' | 'AWAITING_REVIEW'

export interface ResponseGovernanceStudentStatus {
  readonly guidanceLabel: MessageGuidanceLabel
  readonly reviewStatus: StudentVisibleReviewStatus
}

export interface ResponseGovernanceDecision {
  readonly policyVersion: typeof RESPONSE_GOVERNANCE_VERSION
  readonly content: string
  readonly display: ResponseGovernanceDisplay
  readonly safeRefusal: boolean
  readonly createReview: boolean
  readonly reasons: readonly AutomaticPolicyReason[]
  readonly reviewEvidence: AutomaticReviewEvidenceInput | null
  readonly studentStatus: ResponseGovernanceStudentStatus
}
