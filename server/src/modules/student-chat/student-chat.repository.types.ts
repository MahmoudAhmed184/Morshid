import type {
  MaterialStatus,
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  Prisma,
} from '../../generated/prisma/client'
import type { AuditRequestContext } from '../audit/audit.service'

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
  authorUserId: string | null
  responseToMessageId: string | null
  content: string
  status: MessageStatus
  requestKind: MessageRequestKind | null
  guidanceLabel: MessageGuidanceLabel | null
  hintLevel: number | null
  errorCode: string | null
  createdAt: Date
  completedAt: Date | null
  citations: ChatMessageCitationRecord[]
  retrievals: ChatMessageRetrievalRecord[]
}

export interface ChatMessageCitationRecord {
  citationOrder: number
  material: {
    id: string
    title: string
    storagePath: string
    status: MaterialStatus
    deletedAt: Date | null
    extractedTextLength: number | null
    chunkCount: number | null
  }
}

export interface ChatMessageRetrievalRecord {
  rank: number
  similarityScore: Prisma.Decimal | null
  chunk: {
    id: string
    materialId: string
    chunkIndex: number
    content: string
  } | null
}

export interface AppendStudentMessageInput {
  courseId: string
  sessionId: string
  studentId: string
  content: string
  requestKind?: MessageRequestKind | null
  guidanceLabel?: MessageGuidanceLabel | null
  hintLevel?: number | null
}

export interface AppendPendingAssistantMessageInput {
  courseId: string
  sessionId: string
  studentId: string
  responseToMessageId?: string | null
  content?: string
  requestKind?: MessageRequestKind | null
  guidanceLabel?: MessageGuidanceLabel | null
  hintLevel?: number | null
}

export interface CompleteAssistantMessageInput {
  courseId: string
  sessionId: string
  studentId: string
  messageId: string
  content: string
  provider?: string | null
  model?: string | null
  promptVersion?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  guidanceLabel?: MessageGuidanceLabel | null
}

export interface FailAssistantMessageInput {
  courseId: string
  sessionId: string
  studentId: string
  messageId: string
  errorCode: string
  safeErrorMessage?: string | null
}

export interface BlockAssistantMessageInput {
  courseId: string
  sessionId: string
  studentId: string
  messageId: string
  errorCode: string
}

export type MessagePersistenceResult =
  | { kind: 'ok'; message: ChatMessageRecord }
  | { kind: 'membership_missing' }
  | { kind: 'session_not_found' }
  | { kind: 'message_not_found'; messageId: string }
  | { kind: 'message_not_pending'; messageId: string }

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
