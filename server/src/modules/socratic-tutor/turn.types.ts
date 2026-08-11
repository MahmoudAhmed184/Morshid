import type {
  MessageRequestKind,
  TutoringAttemptFailureCode,
  TutoringAttemptStatus,
  TutoringApprovalSource,
  TutoringSafeFallbackReason,
  TeachingStrategy,
} from '../../generated/prisma/client'
import type { TURN_ERROR_CODES } from './turn.errors'

export const TURN_ACQUISITION_OUTCOME = {
  CREATED: 'CREATED',
  COMPLETED: 'COMPLETED',
  ALREADY_PROCESSING: 'ALREADY_PROCESSING',
  FAILED: 'FAILED',
} as const

export type TurnAcquisitionOutcome =
  (typeof TURN_ACQUISITION_OUTCOME)[keyof typeof TURN_ACQUISITION_OUTCOME]

export interface TutoringAttemptSessionRecord {
  id: string
  deletedAt: Date | null
}

export interface TutoringAttemptSnapshot {
  id: string
  sessionId: string
  topicId: string | null
  studentMessageId: string | null
  assistantMessageId: string | null
  retryOfAttemptId: string | null
  clientMessageId: string
  requestKind: MessageRequestKind | null
  teachingStrategy: TeachingStrategy | null
  status: TutoringAttemptStatus
  failureCode: TutoringAttemptFailureCode | null
  leaseExpiresAt: Date | null
  claimedAt: Date | null
  version: number
  safeFallbackUsed: boolean
  approvalSource: TutoringApprovalSource | null
  approvedCandidateAttempt: number | null
  safeFallbackReason: TutoringSafeFallbackReason | null
  validationPolicyVersion: string | null
  reviewRequired: boolean
  createdAt: Date
  // Terminal processing timestamp; successful completion is status COMPLETED.
  completedAt: Date | null
}

export interface LinkStudentMessageInput {
  attemptId: string
  studentMessageId: string
}

export interface AttachResolvedTopicInput extends LinkStudentMessageInput {
  topicId: string
}

export type LinkStudentMessageResult =
  | { kind: 'ok'; turn: TutoringAttemptSnapshot }
  | { kind: 'turn_not_found' }
  | { kind: 'message_not_found' }
  | { kind: 'message_role_mismatch' }
  | { kind: 'session_mismatch' }
  | { kind: 'linkage_conflict' }

export type AttachResolvedTopicResult =
  | { kind: 'ok'; turn: TutoringAttemptSnapshot }
  | { kind: 'turn_not_found' }
  | { kind: 'message_not_found' }
  | { kind: 'topic_not_found' }
  | { kind: 'message_role_mismatch' }
  | { kind: 'session_mismatch' }
  | { kind: 'course_mismatch' }
  | { kind: 'linkage_conflict' }

export type TurnAcquisitionResult =
  | {
      outcome: typeof TURN_ACQUISITION_OUTCOME.CREATED
      turn: TutoringAttemptSnapshot
    }
  | {
      outcome: typeof TURN_ACQUISITION_OUTCOME.COMPLETED
      turn: TutoringAttemptSnapshot
    }
  | {
      outcome: typeof TURN_ACQUISITION_OUTCOME.ALREADY_PROCESSING
      code: typeof TURN_ERROR_CODES.ALREADY_PROCESSING
      turn: TutoringAttemptSnapshot
    }
  | {
      outcome: typeof TURN_ACQUISITION_OUTCOME.FAILED
      turn: TutoringAttemptSnapshot
    }
