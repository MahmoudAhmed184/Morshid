export const ReviewStatus = {
  PENDING: 'PENDING',
  IN_REVIEW: 'IN_REVIEW',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
} as const

export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus]

export const ReviewTriggerType = {
  STUDENT_REQUEST: 'STUDENT_REQUEST',
  GENERAL_NOT_FOUND: 'GENERAL_NOT_FOUND',
  CITATION_MISSING: 'CITATION_MISSING',
  SOURCE_CONFLICT: 'SOURCE_CONFLICT',
  POLICY_CHECK_FAILED: 'POLICY_CHECK_FAILED',
  FINAL_ANSWER_RISK: 'FINAL_ANSWER_RISK',
} as const

export type ReviewTriggerType =
  (typeof ReviewTriggerType)[keyof typeof ReviewTriggerType]

export const ReviewActionType = {
  CREATED: 'CREATED',
  TRIGGER_ADDED: 'TRIGGER_ADDED',
  CLAIMED: 'CLAIMED',
  DRAFT_SAVED: 'DRAFT_SAVED',
  APPROVED: 'APPROVED',
  EDITED: 'EDITED',
  REPLACED: 'REPLACED',
  REJECTED: 'REJECTED',
} as const

export type ReviewActionType =
  (typeof ReviewActionType)[keyof typeof ReviewActionType]

export const ReviewOutcome = {
  APPROVED: 'APPROVED',
  EDITED: 'EDITED',
  REPLACED: 'REPLACED',
  REQUEST_REJECTED: 'REQUEST_REJECTED',
} as const

export type ReviewOutcome = (typeof ReviewOutcome)[keyof typeof ReviewOutcome]

export const ReviewInboxItemType = {
  REVIEW_RESOLVED: 'REVIEW_RESOLVED',
  REVIEW_REJECTED: 'REVIEW_REJECTED',
} as const

export type ReviewInboxItemType =
  (typeof ReviewInboxItemType)[keyof typeof ReviewInboxItemType]

export const ReviewInboxItemStatus = {
  UNREAD: 'UNREAD',
  READ: 'READ',
} as const

export type ReviewInboxItemStatus =
  (typeof ReviewInboxItemStatus)[keyof typeof ReviewInboxItemStatus]

export const StudentFlagReason = {
  INCORRECT: 'INCORRECT',
  CONFUSING: 'CONFUSING',
  UNHELPFUL: 'UNHELPFUL',
  COURSE_MISMATCH: 'COURSE_MISMATCH',
  TOO_MUCH_ANSWER: 'TOO_MUCH_ANSWER',
  OTHER: 'OTHER',
} as const

export type StudentFlagReason =
  (typeof StudentFlagReason)[keyof typeof StudentFlagReason]

export type ReviewMessageRole = 'STUDENT' | 'ASSISTANT'
