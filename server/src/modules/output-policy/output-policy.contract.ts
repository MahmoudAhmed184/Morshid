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
  readonly chunkId?: string
  readonly excerpt: string
  readonly rank?: number
  readonly score?: number
}

export interface OutputPolicyInput {
  readonly proposedContent: string
  readonly assessment: OutputPolicyAssessment
  readonly evidence?: readonly OutputPolicyEvidenceSource[]
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
