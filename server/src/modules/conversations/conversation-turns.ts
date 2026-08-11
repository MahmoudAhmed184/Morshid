import type { DatabaseTransaction } from '../../platform/database/database-transaction'
import type { ChatMessageRecord } from './conversation-records'

export type ConversationRequestKind =
  | 'CONCEPTUAL'
  | 'PROBLEM_LIKE'
  | 'ATTEMPT_DIAGNOSIS'
  | 'CODE_DIAGNOSIS'
  | 'UNSAFE'
  | 'OFF_TOPIC'
  | 'AMBIGUOUS'

export type ConversationGuidanceLabel =
  | 'COURSE_GROUNDED'
  | 'GENERAL_NOT_FOUND'
  | 'UNCERTAIN_AWAITING_REVIEW'
  | 'INSTRUCTOR_REVIEWED'
  | 'REFUSAL'

export type ConversationMessageRole = 'STUDENT' | 'ASSISTANT'
export type ConversationMessageStatus =
  'PENDING' | 'STREAMING' | 'COMPLETED' | 'FAILED' | 'BLOCKED'

export type ConversationMessage = ChatMessageRecord

export interface ConversationMessageLookup {
  readonly id?: string
  readonly sessionId?: string
  readonly attemptId?: string
  readonly responseToMessageId?: string
  readonly authorUserId?: string
  readonly role?: ConversationMessageRole
  readonly status?: ConversationMessageStatus
  readonly statuses?: readonly ConversationMessageStatus[]
  readonly excludeId?: string
  readonly content?: string
}

export interface ConversationAuthorizationInput {
  readonly courseId: string
  readonly sessionId: string
  readonly studentId: string
}

export interface LockedConversationSession {
  readonly id: string
  readonly courseId: string
  readonly studentId: string
  readonly lastSequence: number
  readonly deletedAt: Date | null
}

export type ConversationAuthorizationResult =
  | { readonly kind: 'ok'; readonly session: LockedConversationSession }
  | { readonly kind: 'membership_missing' }
  | { readonly kind: 'session_not_found' }

interface NewConversationTurnInput {
  readonly kind: 'new'
  readonly courseId: string
  readonly sessionId: string
  readonly studentId: string
  readonly attemptId: string
  readonly studentMessageId: string
  readonly assistantMessageId: string
  readonly content: string
  readonly requestKind: ConversationRequestKind | null
  readonly now: Date
}

interface RetryConversationTurnInput {
  readonly kind: 'retry'
  readonly courseId: string
  readonly sessionId: string
  readonly studentId: string
  readonly attemptId: string
  readonly studentMessageId: string
  readonly assistantMessageId: string
  readonly now: Date
}

export type AdmitConversationTurnInput =
  NewConversationTurnInput | RetryConversationTurnInput

export type AdmittedTurn =
  | {
      readonly kind: 'admitted'
      readonly studentMessage: ConversationMessage
      readonly assistantMessage: ConversationMessage
    }
  | { readonly kind: 'membership_missing' }
  | { readonly kind: 'session_not_found' }
  | { readonly kind: 'turn_in_progress' }

export interface FinalizeConversationMessageInput {
  readonly courseId: string
  readonly sessionId: string
  readonly studentId: string
  readonly attemptId: string
  readonly topicId?: string | null
  readonly studentMessageId: string
  readonly assistantMessageId: string
  readonly status: Exclude<ConversationMessageStatus, 'PENDING' | 'STREAMING'>
  readonly content: string
  readonly errorCode?: string | null
  readonly requestKind?: ConversationRequestKind | null
  readonly guidanceLabel?: ConversationGuidanceLabel | null
  readonly hintLevel?: number | null
  readonly provider?: string | null
  readonly model?: string | null
  readonly promptVersion?: string | null
  readonly inputTokens?: number | null
  readonly outputTokens?: number | null
  readonly authorization?: 'active_membership' | 'session_owner'
  readonly completedAt: Date
}

export type FinalizedMessage =
  | { readonly kind: 'finalized'; readonly message: ConversationMessage }
  | { readonly kind: 'membership_missing' }
  | { readonly kind: 'session_not_found' }
  | { readonly kind: 'message_not_found' }
  | { readonly kind: 'message_not_pending' }

export abstract class ConversationTurns {
  abstract authorizeStudent(
    input: ConversationAuthorizationInput,
    transaction: DatabaseTransaction,
  ): Promise<ConversationAuthorizationResult>

  abstract authorizeSessionOwner(
    input: ConversationAuthorizationInput,
    transaction: DatabaseTransaction,
  ): Promise<
    Extract<
      ConversationAuthorizationResult,
      { kind: 'ok' | 'session_not_found' }
    >
  >

  abstract admit(
    input: AdmitConversationTurnInput,
    transaction: DatabaseTransaction,
  ): Promise<AdmittedTurn>

  abstract finalize(
    input: FinalizeConversationMessageInput,
    transaction: DatabaseTransaction,
  ): Promise<FinalizedMessage>

  abstract find(
    input: ConversationMessageLookup & { readonly studentId?: string },
    transaction?: DatabaseTransaction,
  ): Promise<ConversationMessage | null>
}
