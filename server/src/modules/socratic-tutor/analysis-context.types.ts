import type {
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  RevealPolicy,
  TeachingStrategy,
  TeachingTechnique,
} from '../../generated/prisma/client'
import type { TopicStateSnapshot } from './topic-state.types'
import type { TopicRecord } from './topic.types'

export const DEFAULT_ANALYSIS_CONTEXT_HISTORY_TOKEN_BUDGET = 1200
export const DEFAULT_ANALYSIS_CONTEXT_HISTORY_MESSAGE_LIMIT = 24
export const MAX_ANALYSIS_CONTEXT_HISTORY_TOKEN_BUDGET = 4000
export const MAX_ANALYSIS_CONTEXT_HISTORY_MESSAGE_LIMIT = 60

export interface BuildAnalysisContextInput {
  courseId: string
  sessionId: string
  studentId: string
  studentMessageId: string
  activeTopicId: string
  conversationLanguage?: string | null
  historyTokenBudget?: number
  historyMessageLimit?: number
}

export interface AnalysisContextPackage {
  studentMessage: AnalysisContextMessage
  activeTopic: TopicRecord
  topicState: TopicStateSnapshot | null
  selectedHistory: AnalysisContextMessage[]
  previousTutorQuestion: AnalysisContextTextReference | null
  previousStudentAttempt: AnalysisContextTextReference | null
  previousTeachingDecision: PreviousTeachingDecisionContext | null
  problemMetadata: ProblemMetadataContext | null
  conceptMetadata: ConceptMetadataContext | null
  courseMetadata: CourseMetadataContext | null
  conversationLanguage: string | null
  tokenBudget: AnalysisContextTokenBudget
}

export interface AnalysisContextMessage {
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
  createdAt: Date
  completedAt: Date | null
}

export interface AnalysisContextTextReference {
  source: 'selected_history' | 'topic_state'
  content: string
  messageId: string | null
  sequence: number | null
}

export interface PreviousTeachingDecisionContext {
  source: 'topic_state'
  activeStrategy: TeachingStrategy | null
  primaryTechnique: TeachingTechnique | null
  supportingTechnique: TeachingTechnique | null
  guidanceLevel: number
  revealPolicy: RevealPolicy
  updatedAt: Date
}

export interface ProblemMetadataContext {
  id: string
}

export interface ConceptMetadataContext {
  id: string
}

export interface CourseMetadataContext {
  id: string
  code: string
  title: string
}

export interface AnalysisContextTokenBudget {
  maxHistoryTokens: number
  maxHistoryMessages: number
  approximateHistoryTokens: number
  tokenizer: 'char_approximation_v1'
}
