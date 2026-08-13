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

export type ConversationAnalysisMessage = Pick<
  ChatMessageRecord,
  | 'id'
  | 'sequence'
  | 'role'
  | 'attemptId'
  | 'topicId'
  | 'authorUserId'
  | 'responseToMessageId'
  | 'content'
  | 'status'
  | 'requestKind'
  | 'guidanceLabel'
  | 'hintLevel'
  | 'createdAt'
  | 'completedAt'
>

export interface ConversationAnalysisContext {
  readonly courseMetadata: {
    readonly id: string
    readonly code: string
    readonly title: string
  }
  readonly studentMessage: ConversationAnalysisMessage
}

export interface ConversationAnalysisContextInput {
  readonly courseId: string
  readonly sessionId: string
  readonly studentId: string
  readonly studentMessageId: string
}

export interface ConversationAnalysisHistoryInput {
  readonly courseId: string
  readonly sessionId: string
  readonly studentId: string
  readonly topicId: string
  readonly beforeSequence: number
}

export interface ConversationStudentMessageCountInput {
  readonly sessionId: string
  readonly messageIds: readonly string[]
}

export const CONVERSATION_ANALYSIS_HISTORY_LIMIT = 80
