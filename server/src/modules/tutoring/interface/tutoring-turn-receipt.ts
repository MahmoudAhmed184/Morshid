export type TutoringMessageRole = 'STUDENT' | 'ASSISTANT' | 'SYSTEM'

export type TutoringMessageStatus =
  'PENDING' | 'STREAMING' | 'COMPLETED' | 'FAILED' | 'BLOCKED'

export type TutoringRequestKind =
  | 'CONCEPTUAL'
  | 'PROBLEM_LIKE'
  | 'ATTEMPT_DIAGNOSIS'
  | 'CODE_DIAGNOSIS'
  | 'UNSAFE'
  | 'OFF_TOPIC'
  | 'AMBIGUOUS'

export type TutoringGuidanceLabel =
  | 'COURSE_GROUNDED'
  | 'GENERAL_NOT_FOUND'
  | 'UNCERTAIN_AWAITING_REVIEW'
  | 'INSTRUCTOR_REVIEWED'
  | 'REFUSAL'

export type TutoringReviewStatus =
  'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED'

export type TutoringReviewOutcome =
  'APPROVED' | 'EDITED' | 'REPLACED' | 'REQUEST_REJECTED' | null

export interface TutoringCitationEvidenceReceipt {
  readonly rank: number
  readonly similarityScore: number
  readonly chunkId: string
  readonly chunkNumber: number
  readonly excerpt: string
}

export interface TutoringCitationReceipt {
  readonly order: number
  readonly materialId: string
  readonly materialTitle: string
  readonly sourceAvailable: boolean
  readonly sourceStatus: 'AVAILABLE' | 'DELETED' | 'UNAVAILABLE'
  readonly evidence: readonly TutoringCitationEvidenceReceipt[]
}

export interface TutoringReviewSummaryReceipt {
  readonly reviewCaseId: string
  readonly status: TutoringReviewStatus
  readonly outcome: TutoringReviewOutcome
  readonly resolvedAt: string | null
}

export interface TutoringMessageReceipt {
  readonly id: string
  readonly sequence: number
  readonly role: TutoringMessageRole
  readonly attemptId: string | null
  readonly topicId: string | null
  readonly responseToMessageId: string | null
  readonly content: string
  readonly status: TutoringMessageStatus
  readonly requestKind: TutoringRequestKind | null
  readonly guidanceLabel: TutoringGuidanceLabel | null
  readonly hintLevel: number | null
  readonly promptVersion: string | null
  readonly errorCode: string | null
  readonly createdAt: string
  readonly completedAt: string | null
  readonly citations: readonly TutoringCitationReceipt[]
  readonly reviewSummary: TutoringReviewSummaryReceipt | null
}

export interface TutoringTurnReceipt {
  readonly studentMessage: TutoringMessageReceipt
  readonly assistantMessage: TutoringMessageReceipt
}
