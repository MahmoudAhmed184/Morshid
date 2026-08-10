import {
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  ReflectionMode,
  RevealPolicy,
  TeachingStrategy,
  TeachingTechnique,
  TopicStatus,
  TopicType,
} from '../../src/generated/prisma/client'
import type { AnalysisContextPackage } from '../../src/modules/socratic-tutor/analysis-context.types'
import type { PersistedEducationalAnalysisRecord } from '../../src/modules/socratic-tutor/educational-analysis.repository'
import type { EducationalAnalysisResult } from '../../src/modules/socratic-tutor/educational-analysis.types'
import {
  EDUCATIONAL_ANALYSIS_SCHEMA_VERSION,
  EDUCATIONAL_ANALYSIS_SOURCE,
} from '../../src/modules/socratic-tutor/educational-analysis.types'
import type { PersistedTeachingDecisionRecord } from '../../src/modules/socratic-tutor/teaching-decision.repository'
import type { RetrievedChunk } from '../../src/modules/retrieval/retrieval.service'
import { TEACHING_POLICY_VERSION } from '../../src/modules/socratic-tutor/teaching-policy.types'

export const GEMINI_SOCRATIC_LIVE_IDS = {
  courseId: 'gemini-live-course',
  sessionId: 'gemini-live-session',
  topicId: 'gemini-live-topic',
  turnId: 'gemini-live-turn',
  studentMessageId: 'gemini-live-message-student-current',
  previousTutorMessageId: 'gemini-live-message-tutor-previous',
} as const

const createdAt = new Date('2026-01-01T00:00:00.000Z')

export const GEMINI_SOCRATIC_ANALYSIS_CONTEXT: AnalysisContextPackage = {
  studentMessage: {
    id: GEMINI_SOCRATIC_LIVE_IDS.studentMessageId,
    sequence: 2,
    role: MessageRole.STUDENT,
    turnId: GEMINI_SOCRATIC_LIVE_IDS.turnId,
    topicId: GEMINI_SOCRATIC_LIVE_IDS.topicId,
    authorUserId: 'gemini-live-student',
    responseToMessageId: GEMINI_SOCRATIC_LIVE_IDS.previousTutorMessageId,
    content:
      'I tried substituting x = 2 into 3x + 4 and got 10, but I am not sure how to check the step.',
    status: MessageStatus.COMPLETED,
    requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
    guidanceLabel: null,
    hintLevel: null,
    createdAt,
    completedAt: createdAt,
  },
  activeTopic: {
    id: GEMINI_SOCRATIC_LIVE_IDS.topicId,
    sessionId: GEMINI_SOCRATIC_LIVE_IDS.sessionId,
    courseId: GEMINI_SOCRATIC_LIVE_IDS.courseId,
    problemId: 'gemini-live-problem',
    conceptId: 'gemini-live-linear-expression',
    title: 'Evaluate a linear expression',
    topicType: TopicType.PROBLEM,
    status: TopicStatus.ACTIVE,
    resolvedAt: null,
    createdAt,
    updatedAt: createdAt,
  },
  topicState: null,
  selectedHistory: [
    {
      id: GEMINI_SOCRATIC_LIVE_IDS.previousTutorMessageId,
      sequence: 1,
      role: MessageRole.ASSISTANT,
      turnId: null,
      topicId: GEMINI_SOCRATIC_LIVE_IDS.topicId,
      authorUserId: null,
      responseToMessageId: null,
      content:
        'Try replacing x with the given number, then simplify multiplication before addition.',
      status: MessageStatus.COMPLETED,
      requestKind: null,
      guidanceLabel: null,
      hintLevel: 1,
      createdAt,
      completedAt: createdAt,
    },
  ],
  previousTutorQuestion: {
    source: 'selected_history',
    content:
      'Try replacing x with the given number, then simplify multiplication before addition.',
    messageId: GEMINI_SOCRATIC_LIVE_IDS.previousTutorMessageId,
    sequence: 1,
  },
  previousStudentAttempt: null,
  previousTeachingDecision: null,
  problemMetadata: { id: 'gemini-live-problem' },
  conceptMetadata: { id: 'gemini-live-linear-expression' },
  courseMetadata: {
    id: GEMINI_SOCRATIC_LIVE_IDS.courseId,
    code: 'LIVE-101',
    title: 'Synthetic Live Verification',
  },
  conversationLanguage: 'en',
  tokenBudget: {
    maxHistoryTokens: 1200,
    maxHistoryMessages: 24,
    approximateHistoryTokens: 60,
    tokenizer: 'char_approximation_v1',
  },
}

export const GEMINI_SOCRATIC_RETRIEVED_CHUNKS: readonly RetrievedChunk[] = [
  {
    chunkId: 'gemini-live-chunk-1',
    materialId: 'gemini-live-material-1',
    materialTitle: 'Synthetic linear expressions guide',
    chunkIndex: 0,
    rank: 1,
    similarityScore: 0.99,
    embeddingModel: 'gemini-embedding-004',
    content:
      'To evaluate 3x + 4 for x = 2, substitute 2 for x, multiply 3 by 2, then add 4. The check is that multiplication is completed before addition.',
  },
]

export function buildLivePersistedAnalysis(
  result: EducationalAnalysisResult,
  metadata: {
    readonly provider: string
    readonly model: string
    readonly modelVersion?: string | null
    readonly promptVersion: string
    readonly inputTokens?: number
    readonly outputTokens?: number
    readonly latencyMs?: number
  },
): PersistedEducationalAnalysisRecord {
  return {
    id: 'gemini-live-analysis',
    turnId: GEMINI_SOCRATIC_LIVE_IDS.turnId,
    topicId: GEMINI_SOCRATIC_LIVE_IDS.topicId,
    studentMessageId: GEMINI_SOCRATIC_LIVE_IDS.studentMessageId,
    attempt: 1,
    result,
    provider: metadata.provider,
    model: metadata.model,
    modelVersion: metadata.modelVersion ?? null,
    promptVersion: metadata.promptVersion,
    schemaVersion: EDUCATIONAL_ANALYSIS_SCHEMA_VERSION,
    inputTokens: metadata.inputTokens ?? null,
    outputTokens: metadata.outputTokens ?? null,
    latencyMs: metadata.latencyMs ?? null,
    analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
    fallbackReason: null,
    failureCategory: null,
    confidencePolicyVersion: null,
    infrastructureRetryCount: 0,
    evidenceLinks: [],
    misconceptionRecords: [],
    createdAt,
  }
}

export function buildLiveTeachingDecision(
  analysisId: string,
): PersistedTeachingDecisionRecord {
  return {
    id: 'gemini-live-teaching-decision',
    turnId: GEMINI_SOCRATIC_LIVE_IDS.turnId,
    topicId: GEMINI_SOCRATIC_LIVE_IDS.topicId,
    analysisId,
    strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
    primaryTechnique: TeachingTechnique.FOCUSED_QUESTION,
    supportingTechnique: null,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    reflectionMode: ReflectionMode.NONE,
    requireStudentAction: true,
    guardPolicy: {
      preventDirectAnswer: true,
      preventFinalResult: true,
      preventCompleteSolution: true,
      preventSubmissionReadyCode: true,
      preventProtectedCodeLeakage: true,
      requireStudentReasoning: true,
      requireGrounding: true,
      enforceCitationSupport: true,
      maximumDisclosedSteps: 1,
    },
    decisionReason: 'Live Socratic Gemini verification fixture.',
    policyVersion: TEACHING_POLICY_VERSION,
    createdAt,
  }
}
