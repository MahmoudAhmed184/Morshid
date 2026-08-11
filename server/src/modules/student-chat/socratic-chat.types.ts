import type { AutomaticSafetyRiskDetection } from '../output-policy/automatic-safety-risk.detector'
import type { ControlledSourceConflict } from '../output-policy/controlled-source-conflict.detector'
import type { RequestBudget } from '../../common/http/request-deadline'
import type { ChatMessageRecord } from './student-chat.repository.types'

export interface SocraticTopicSelection {
  readonly topicId?: string | null
  readonly problemId?: string
  readonly conceptId?: string
  readonly title?: string
}

/**
 * Input from {@link GroundedChatService} to the Socratic orchestrator.
 *
 * All identifiers are already persisted by `beginTurn` / `retryTurn`
 * before the orchestrator is invoked.
 */
export interface SocraticOrchestrationInput {
  readonly courseId: string
  readonly sessionId: string
  readonly studentId: string
  readonly studentMessageId: string
  readonly assistantMessageId: string
  readonly studentMessageContent: string
  readonly topicSelection?: SocraticTopicSelection
  readonly requestBudget?: RequestBudget
  /**
   * Deterministic idempotency key for the TutorTurn.
   *
   * - **send path**: equals the persisted `studentMessageId`.
   * - **retry path**: `${studentMessageId}:${attemptId}` where both values
   *   are already persisted by `retryTurn`.
   */
  readonly idempotencyKey: string
}

export type SocraticOrchestrationResult =
  | {
      readonly kind: 'completed'
      readonly studentMessage: ChatMessageRecord
      readonly assistantMessage: ChatMessageRecord
    }
  | {
      readonly kind: 'safety_refusal'
      readonly detection: AutomaticSafetyRiskDetection
    }
  | {
      readonly kind: 'source_conflict'
      readonly conflict: ControlledSourceConflict
    }
  | {
      readonly kind: 'blocked'
      readonly reason: 'insufficient_evidence' | 'embedding_profile_not_ready'
    }
  | {
      readonly kind: 'failed'
      readonly errorCode: string
    }
