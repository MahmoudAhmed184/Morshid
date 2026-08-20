import type {
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
} from './conversation-values'
import type { AuditRequestContext } from '../../audit/audit.public'

export interface ChatSessionRecord {
  id: string
  courseId: string
  title: string
  lastSequence: number
  lastMessageAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface SoftDeleteChatSessionInput {
  courseId: string
  sessionId: string
  studentId: string
  requestContext?: AuditRequestContext
}

export interface ChatMessageRecord {
  id: string
  sequence: number
  role: MessageRole
  attemptId: string | null
  topicId: string | null
  authorUserId: string | null
  responseToMessageId: string | null
  content: string
  status: MessageStatus
  requestKind: MessageRequestKind | null
  guidanceLabel: MessageGuidanceLabel | null
  hintLevel: number | null
  promptVersion: string | null
  errorCode: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  createdAt: Date
  completedAt: Date | null
}

export interface ChatSessionSummaryRecord {
  turnsUsed: number
  turnLimit: number
  turnsRemaining: number
  isTurnLimitExhausted: boolean
  contextTokens: number
  maxContextTokens: number
  contextPercent: number
  totalProcessedTokens: number | null
  policyDay: string
  policyTimeZone: string
  resetAt: string
}

export interface SessionListPagination {
  limit: number
  cursor?: string | null
}

export interface MessageListPagination {
  limit: number
  after?: number | null
  before?: number | null
  latest?: boolean
}

export type SoftDeleteSessionOutcome =
  'deleted' | 'already_deleted' | 'not_found'

export interface ExportableSessionRecord {
  id: string
  title: string
  createdAt: Date
  course: {
    id: string
    code: string
    title: string
  }
}

export interface ExportableMessageRecord {
  id: string
  sequence: number
  role: MessageRole
  content: string
  guidanceLabel: MessageGuidanceLabel | null
  createdAt: Date
  completedAt: Date | null
}
