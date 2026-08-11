import type { TopicStatus, TopicType } from '../../../generated/prisma/client'

export const TOPIC_RESOLUTION_OUTCOME = {
  CONTINUE_CURRENT_TOPIC: 'CONTINUE_CURRENT_TOPIC',
  CREATE_NEW_TOPIC: 'CREATE_NEW_TOPIC',
  RESUME_PREVIOUS_TOPIC: 'RESUME_PREVIOUS_TOPIC',
  REOPEN_EXISTING_TOPIC: 'REOPEN_EXISTING_TOPIC',
  UNRESOLVED: 'UNRESOLVED',
} as const

export type TopicResolutionOutcome =
  (typeof TOPIC_RESOLUTION_OUTCOME)[keyof typeof TOPIC_RESOLUTION_OUTCOME]

export const TOPIC_STABLE_IDENTITY_SOURCE = {
  PROBLEM_ID: 'PROBLEM_ID',
  CONCEPT_ID: 'CONCEPT_ID',
  ACTIVE_TOPIC: 'ACTIVE_TOPIC',
  DETERMINISTIC_FALLBACK: 'DETERMINISTIC_FALLBACK',
  NONE: 'NONE',
} as const

export type TopicStableIdentitySource =
  (typeof TOPIC_STABLE_IDENTITY_SOURCE)[keyof typeof TOPIC_STABLE_IDENTITY_SOURCE]

export interface TopicResolution {
  outcome: TopicResolutionOutcome
  topicId: string | null
  previousTopicId: string | null
  confidence: number
  stableIdentitySource: TopicStableIdentitySource
  reason: string
}

export const TOPIC_RESOLUTION_EVIDENCE_TYPE = {
  VERIFIED_CORRECT_SOLUTION: 'VERIFIED_CORRECT_SOLUTION',
  CORRECTED_MISCONCEPTION_WITH_EXPLANATION:
    'CORRECTED_MISCONCEPTION_WITH_EXPLANATION',
  INDEPENDENT_REASONING_COMPLETION: 'INDEPENDENT_REASONING_COMPLETION',
  SUCCESSFUL_TRANSFER_OR_VERIFICATION: 'SUCCESSFUL_TRANSFER_OR_VERIFICATION',
  TUTOR_PROVIDED_ANSWER: 'TUTOR_PROVIDED_ANSWER',
  STUDENT_STOPPED_RESPONDING: 'STUDENT_STOPPED_RESPONDING',
  STUDENT_SAID_THANKS: 'STUDENT_SAID_THANKS',
  STUDENT_CLAIMED_UNDERSTANDING: 'STUDENT_CLAIMED_UNDERSTANDING',
  MAX_GUIDANCE_LEVEL_REACHED: 'MAX_GUIDANCE_LEVEL_REACHED',
} as const

export type TopicResolutionEvidenceType =
  (typeof TOPIC_RESOLUTION_EVIDENCE_TYPE)[keyof typeof TOPIC_RESOLUTION_EVIDENCE_TYPE]

export const SUFFICIENT_TOPIC_RESOLUTION_EVIDENCE_TYPES =
  new Set<TopicResolutionEvidenceType>([
    TOPIC_RESOLUTION_EVIDENCE_TYPE.VERIFIED_CORRECT_SOLUTION,
    TOPIC_RESOLUTION_EVIDENCE_TYPE.CORRECTED_MISCONCEPTION_WITH_EXPLANATION,
    TOPIC_RESOLUTION_EVIDENCE_TYPE.INDEPENDENT_REASONING_COMPLETION,
    TOPIC_RESOLUTION_EVIDENCE_TYPE.SUCCESSFUL_TRANSFER_OR_VERIFICATION,
  ])

export interface TopicResolutionEvidenceInput {
  type: TopicResolutionEvidenceType
  evidenceMessageIds: string[]
  reason: string
}

export interface ResolveTopicInput {
  sessionId: string
  courseId?: string | null
  topicId?: string | null
  problemId?: string | null
  conceptId?: string | null
  title?: string | null
}

export interface CreateTopicInput {
  sessionId: string
  courseId?: string | null
  title: string
  problemId?: string | null
  conceptId?: string | null
  topicType?: TopicType
}

export interface TopicByIdInput {
  sessionId: string
  courseId?: string | null
  topicId: string
}

export interface ResolveAsResolvedInput extends TopicByIdInput {
  evidence: TopicResolutionEvidenceInput
}

export interface TopicScope {
  sessionId: string
  courseId: string
}

export interface TopicSessionRecord {
  id: string
  courseId: string
  deletedAt: Date | null
}

export interface TopicRecord extends TopicScope {
  id: string
  problemId: string | null
  conceptId: string | null
  title: string
  topicType: TopicType
  status: TopicStatus
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ActiveTopicReplacementResult {
  topic: TopicRecord
  previousTopicId: string | null
}
