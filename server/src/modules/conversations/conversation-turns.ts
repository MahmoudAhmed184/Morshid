import type { DatabaseTransaction } from '../prisma/database-transaction'

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

export interface ConversationMessage {
  readonly id: string
  readonly sessionId: string
  readonly attemptId: string | null
  readonly sequence: number
  readonly role: ConversationMessageRole
  readonly status: ConversationMessageStatus
  readonly content: string
  readonly completedAt: Date | null
}

export interface AdmitConversationTurnInput {
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
  abstract admit(
    input: AdmitConversationTurnInput,
    transaction: DatabaseTransaction,
  ): Promise<AdmittedTurn>

  abstract finalize(
    input: FinalizeConversationMessageInput,
    transaction: DatabaseTransaction,
  ): Promise<FinalizedMessage>
}
