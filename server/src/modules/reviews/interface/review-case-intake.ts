import type { AuditRequestContext } from '../../audit/audit.public'
import type { DatabaseTransaction } from '../../../platform/database/database-transaction'

import type { ReviewStatus, ReviewTriggerType } from './review-values'

export interface AutomaticReviewEvidenceSource {
  materialId?: string
  materialTitle?: string
  chunkId?: string
  chunkIndex?: number
  excerpt: string
  rank?: number
  score?: number
}

export interface AutomaticReviewEvidenceFact {
  code: string
  value: string | number | boolean
}

export interface AutomaticReviewEvidenceInput {
  summary: string
  sources?: readonly AutomaticReviewEvidenceSource[]
  facts?: readonly AutomaticReviewEvidenceFact[]
}

export interface AutomaticReviewIntakeTrigger {
  readonly trigger: Exclude<ReviewTriggerType, 'STUDENT_REQUEST'>
  readonly sourceEventKey: string
  readonly detectorMetadata?: Readonly<
    Record<string, string | number | boolean | null>
  >
}

export interface AutomaticReviewIntakeInput {
  readonly messageId: string
  readonly triggers: readonly AutomaticReviewIntakeTrigger[]
  readonly evidence: AutomaticReviewEvidenceInput
  readonly requestContext?: AuditRequestContext
}

export interface AutomaticReviewIntakeResult {
  readonly caseId: string
  readonly messageId: string
  readonly status: ReviewStatus
  readonly replayed: boolean
}

export abstract class ReviewCaseIntake {
  abstract openAutomatic(
    input: AutomaticReviewIntakeInput,
    transaction: DatabaseTransaction,
  ): Promise<AutomaticReviewIntakeResult>
}
