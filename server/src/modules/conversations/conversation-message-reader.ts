import type { DatabaseTransaction } from '../../platform/database/database-transaction'
import type { ChatMessageRecord } from './conversation-records'

export type ConversationMessageRole = 'STUDENT' | 'ASSISTANT'
export type ConversationMessageStatus =
  'PENDING' | 'STREAMING' | 'COMPLETED' | 'FAILED' | 'BLOCKED'

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

export abstract class ConversationMessageReader {
  abstract find(
    input: ConversationMessageLookup & { readonly studentId?: string },
    transaction?: DatabaseTransaction,
  ): Promise<ChatMessageRecord | null>
}
