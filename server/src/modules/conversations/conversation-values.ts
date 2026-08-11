export const MessageRole = {
  STUDENT: 'STUDENT',
  ASSISTANT: 'ASSISTANT',
  SYSTEM: 'SYSTEM',
} as const

export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole]

export const MessageStatus = {
  PENDING: 'PENDING',
  STREAMING: 'STREAMING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
} as const

export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus]

export const MessageRequestKind = {
  CONCEPTUAL: 'CONCEPTUAL',
  PROBLEM_LIKE: 'PROBLEM_LIKE',
  ATTEMPT_DIAGNOSIS: 'ATTEMPT_DIAGNOSIS',
  CODE_DIAGNOSIS: 'CODE_DIAGNOSIS',
  UNSAFE: 'UNSAFE',
  OFF_TOPIC: 'OFF_TOPIC',
  AMBIGUOUS: 'AMBIGUOUS',
} as const

export type MessageRequestKind =
  (typeof MessageRequestKind)[keyof typeof MessageRequestKind]

export const MessageGuidanceLabel = {
  COURSE_GROUNDED: 'COURSE_GROUNDED',
  GENERAL_NOT_FOUND: 'GENERAL_NOT_FOUND',
  UNCERTAIN_AWAITING_REVIEW: 'UNCERTAIN_AWAITING_REVIEW',
  INSTRUCTOR_REVIEWED: 'INSTRUCTOR_REVIEWED',
  REFUSAL: 'REFUSAL',
} as const

export type MessageGuidanceLabel =
  (typeof MessageGuidanceLabel)[keyof typeof MessageGuidanceLabel]

export interface DecimalLike {
  toNumber(): number
  toString(): string
}
