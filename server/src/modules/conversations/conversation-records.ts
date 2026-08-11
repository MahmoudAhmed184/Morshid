import type {
  DecimalLike,
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
} from './conversation-values'
import type { MaterialStatus } from '../materials/materials.public'
import type { AuditRequestContext } from '../audit/audit.public'

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
  createdAt: Date
  completedAt: Date | null
  reviewCase?: {
    id: string
    status: 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED'
    outcome: 'APPROVED' | 'EDITED' | 'REPLACED' | 'REQUEST_REJECTED' | null
    resolvedAt: Date | null
    triggers: { id: string }[]
  } | null
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
  similarityScore: DecimalLike | null
  chunk: {
    id: string
    materialId: string
    chunkIndex: number
    content: string
    embeddingModel: string
  } | null
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
