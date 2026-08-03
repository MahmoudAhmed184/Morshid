import type {
  TutorTurnFailureCode,
  TutorTurnStatus,
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
  createdAt: Date
  completedAt: Date | null
}

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
