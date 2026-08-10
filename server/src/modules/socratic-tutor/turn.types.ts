import type {
  TutorTurnFailureCode,
  TutorTurnStatus,
  TutorApprovalSource,
  TutorSafeFallbackReason,
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

export interface TutorTurnSessionRecord {
  id: string
  deletedAt: Date | null
}

export interface TutorTurnSnapshot {
  id: string
  sessionId: string
  topicId: string | null
  studentMessageId: string | null
  approvedTutorMessageId: string | null
  idempotencyKey: string
  status: TutorTurnStatus
  failureCode: TutorTurnFailureCode | null
  safeFallbackUsed: boolean
  approvalSource: TutorApprovalSource | null
  approvedCandidateAttempt: number | null
  safeFallbackReason: TutorSafeFallbackReason | null
  validationPolicyVersion: string | null
  createdAt: Date
  // Terminal processing timestamp; successful completion is status COMPLETED.
  completedAt: Date | null
}

export interface LinkStudentMessageInput {
  turnId: string
  studentMessageId: string
}

export interface AttachResolvedTopicInput extends LinkStudentMessageInput {
  topicId: string
}

export type LinkStudentMessageResult =
  | { kind: 'ok'; turn: TutorTurnSnapshot }
  | { kind: 'turn_not_found' }
  | { kind: 'message_not_found' }
  | { kind: 'message_role_mismatch' }
  | { kind: 'session_mismatch' }
  | { kind: 'linkage_conflict' }

export type AttachResolvedTopicResult =
  | { kind: 'ok'; turn: TutorTurnSnapshot }
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
      turn: TutorTurnSnapshot
    }
  | {
      outcome: typeof TURN_ACQUISITION_OUTCOME.COMPLETED
      turn: TutorTurnSnapshot
    }
  | {
      outcome: typeof TURN_ACQUISITION_OUTCOME.ALREADY_PROCESSING
      code: typeof TURN_ERROR_CODES.ALREADY_PROCESSING
      turn: TutorTurnSnapshot
    }
  | {
      outcome: typeof TURN_ACQUISITION_OUTCOME.FAILED
      turn: TutorTurnSnapshot
    }
