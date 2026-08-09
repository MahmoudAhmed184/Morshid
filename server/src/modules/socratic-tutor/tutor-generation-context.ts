import type { AnalysisContextPackage } from './analysis-context.types'
import {
  type GenerationContextPackage,
  TUTOR_CANDIDATE_LIMITS,
  type TutorEvidenceContext,
  type TutorGuardEducationalContext,
} from './tutor-generation.types'
import type { RetrievedChunk } from '../retrieval/retrieval.service'
import type { PersistedEducationalAnalysisRecord } from './educational-analysis.repository'
import type { PersistedTeachingDecisionRecord } from './teaching-decision.repository'

export type BuildGenerationContextResult =
  | {
      readonly success: true
      readonly context: GenerationContextPackage
    }
  | {
      readonly success: false
      readonly errorCode: 'INVALID_GENERATION_CONTEXT'
    }

export function buildGenerationContextPackage(input: {
  readonly analysisContext: AnalysisContextPackage
  readonly acceptedAnalysis: PersistedEducationalAnalysisRecord
  readonly teachingDecision: PersistedTeachingDecisionRecord
  readonly retrievedChunks: readonly RetrievedChunk[]
}): BuildGenerationContextResult {
  const turnId = input.analysisContext.studentMessage.turnId
  if (
    turnId === null ||
    input.acceptedAnalysis.turnId !== turnId ||
    input.teachingDecision.turnId !== turnId ||
    input.acceptedAnalysis.topicId !== input.analysisContext.activeTopic.id ||
    input.teachingDecision.topicId !== input.analysisContext.activeTopic.id ||
    input.teachingDecision.analysisId !== input.acceptedAnalysis.id ||
    input.acceptedAnalysis.studentMessageId !==
      input.analysisContext.studentMessage.id
  ) {
    return {
      success: false,
      errorCode: 'INVALID_GENERATION_CONTEXT',
    }
  }

  const retrievedEvidence = input.retrievedChunks
    .slice(0, TUTOR_CANDIDATE_LIMITS.maxEvidenceChunks)
    .map(toEvidenceContext)
  const allowedCitationIds = retrievedEvidence.map(
    (evidence) => evidence.citationId,
  )

  return {
    success: true,
    context: Object.freeze({
      turnId,
      sessionId: input.analysisContext.activeTopic.sessionId,
      courseId: input.analysisContext.activeTopic.courseId,
      topicId: input.analysisContext.activeTopic.id,
      studentMessage: input.analysisContext.studentMessage,
      acceptedAnalysis: input.acceptedAnalysis,
      teachingDecision: input.teachingDecision,
      activeTopic: input.analysisContext.activeTopic,
      topicState: input.analysisContext.topicState,
      selectedHistory: Object.freeze(
        input.analysisContext.selectedHistory.slice(
          0,
          TUTOR_CANDIDATE_LIMITS.maxHistoryMessages,
        ),
      ),
      retrievedEvidence: Object.freeze(retrievedEvidence),
      allowedCitationIds: Object.freeze(allowedCitationIds),
      conversationLanguage: input.analysisContext.conversationLanguage,
      regeneration: null,
    }),
  }
}

export function withRegenerationContext(
  context: GenerationContextPackage,
  regeneration: GenerationContextPackage['regeneration'],
): GenerationContextPackage {
  return Object.freeze({
    ...context,
    regeneration,
  })
}

export function guardEducationalContextFromGenerationContext(
  context: GenerationContextPackage,
): TutorGuardEducationalContext {
  return Object.freeze({
    currentStudentMessage: Object.freeze({
      id: context.studentMessage.id,
      content: context.studentMessage.content,
    }),
    acceptedAnalysis: Object.freeze({
      requestKind: context.acceptedAnalysis.result.requestKind,
      studentState: context.acceptedAnalysis.result.studentState,
      misconceptions: context.acceptedAnalysis.result.misconceptions,
    }),
    recentConversation: Object.freeze(
      context.selectedHistory.map((message) =>
        Object.freeze({
          role: message.role,
          content: message.content,
        }),
      ),
    ),
  })
}

function toEvidenceContext(
  chunk: RetrievedChunk,
  index: number,
): TutorEvidenceContext {
  return Object.freeze({
    citationId: citationIdForChunk(chunk),
    chunkId: chunk.chunkId,
    materialId: chunk.materialId,
    materialTitle: truncateCodePoints(chunk.materialTitle, 300),
    chunkIndex: chunk.chunkIndex,
    rank: chunk.rank > 0 ? chunk.rank : index + 1,
    content: truncateCodePoints(
      chunk.content,
      TUTOR_CANDIDATE_LIMITS.maxEvidenceContentCodePoints,
    ),
  })
}

export function citationIdForChunk(
  chunk: Pick<RetrievedChunk, 'rank'>,
): string {
  return `retrieval.rank.${String(chunk.rank)}`
}

function truncateCodePoints(value: string, maximum: number): string {
  return Array.from(value).slice(0, maximum).join('')
}
