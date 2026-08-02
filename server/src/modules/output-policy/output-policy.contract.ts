import type {
  MessageGuidanceLabel,
  ReviewTriggerType,
} from '../../generated/prisma/client'
import type { AutomaticReviewEvidenceContribution } from '../reviews/automatic-review-evidence'

export const OUTPUT_POLICY_VERSION = 'output-policy-v1'

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

export type OutputPolicySupport = 'SUPPORTED' | 'NOT_FOUND' | 'CONFLICTING'
export type OutputPolicyCheck = 'PASSED' | 'FAILED'
export type OutputPolicyAnswerRisk = 'NONE' | 'FINAL_ANSWER'
export type OutputPolicyCitationState = 'PRESENT' | 'MISSING' | 'NOT_REQUIRED'

export interface OutputPolicyAssessment {
  readonly support: OutputPolicySupport
  readonly policyCheck: OutputPolicyCheck
  readonly answerRisk: OutputPolicyAnswerRisk
  readonly citations: OutputPolicyCitationState
}

export interface OutputPolicyEvidenceSource {
  readonly materialId?: string
  readonly materialTitle?: string
  readonly chunkId?: string
  readonly chunkIndex?: number
  readonly excerpt: string
  readonly rank?: number
  readonly score?: number
}

export interface OutputPolicyInput {
  readonly proposedContent: string
  readonly assessment: OutputPolicyAssessment
  readonly controlledConflictKind?: OutputPolicyConflictKind
  readonly evidence?: readonly OutputPolicyEvidenceSource[]
  readonly reviewFacts?: readonly OutputPolicyReviewFact[]
}

export type OutputPolicyConflictKind = 'PYTHON_DIVISION' | 'QUESTION_X_SCHEDULE'

export interface OutputPolicyReviewFact {
  readonly code: 'detector_version' | 'embedding_model'
  readonly value: string
}

export type OutputPolicyDisplay = 'AS_PROPOSED' | 'SAFE_REPLACEMENT'
export type StudentVisibleReviewStatus = 'NOT_REQUIRED' | 'AWAITING_REVIEW'

export interface OutputPolicyStudentStatus {
  readonly guidanceLabel: MessageGuidanceLabel
  readonly reviewStatus: StudentVisibleReviewStatus
}

export interface OutputPolicyDecision {
  readonly policyVersion: typeof OUTPUT_POLICY_VERSION
  readonly content: string
  readonly display: OutputPolicyDisplay
  readonly safeRefusal: boolean
  readonly createReview: boolean
  readonly reasons: readonly AutomaticPolicyReason[]
  readonly reviewEvidence: AutomaticReviewEvidenceContribution | null
  readonly studentStatus: OutputPolicyStudentStatus
}
