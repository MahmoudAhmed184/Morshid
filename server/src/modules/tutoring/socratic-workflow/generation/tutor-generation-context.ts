import {
  type ExplanationDetailLevel,
  normalizeExplanationDetailLevel,
} from '../../tutoring-values'
import type { AnalysisContextPackage } from '../analysis/analysis-context.types'
import {
  type GenerationContextPackage,
  TUTOR_CANDIDATE_LIMITS,
  type TutorEvidenceContext,
  type TutorGuardEducationalContext,
} from './tutor-generation.types'
import type { CourseEvidenceChunk } from '../../../materials/interface/course-evidence'
import type { PersistedEducationalAnalysisRecord } from '../analysis/educational-analysis.repository'
import type { PersistedTeachingDecisionRecord } from '../teaching-decision/teaching-decision.repository'
import type { TeachingGuardPolicy } from '../teaching-decision/teaching-policy.types'
import type { DebuggingGuidanceContext } from '../debugging-guidance/debugging-guidance.output-validator'
import type { OutputProtectionContext } from '../solution-protection/solution-protection.types'
import {
  studentActionObligationFromDecision,
  type StudentActionObligation,
} from '../teaching-decision/student-action-obligation'

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
  readonly previousTeachingDecision: PersistedTeachingDecisionRecord | null
  readonly retrievedChunks: readonly CourseEvidenceChunk[]
  readonly explanationDetailLevel?: ExplanationDetailLevel
  readonly outputProtection: OutputProtectionContext
  readonly debuggingGuidance?: DebuggingGuidanceContext
}): BuildGenerationContextResult {
  const attemptId = input.analysisContext.studentMessage.attemptId
  if (
    attemptId === null ||
    input.acceptedAnalysis.attemptId !== attemptId ||
    input.teachingDecision.attemptId !== attemptId ||
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
      attemptId,
      sessionId: input.analysisContext.activeTopic.sessionId,
      courseId: input.analysisContext.activeTopic.courseId,
      topicId: input.analysisContext.activeTopic.id,
      studentMessage: input.analysisContext.studentMessage,
      acceptedAnalysis: input.acceptedAnalysis,
      teachingDecision: input.teachingDecision,
      previousTeachingDecision: input.previousTeachingDecision,
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
      explanationDetailLevel: normalizeExplanationDetailLevel(
        input.explanationDetailLevel,
      ),
      outputProtection: input.outputProtection,
      regeneration: null,
      debuggingGuidance: input.debuggingGuidance ?? null,
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

export function regenerationMatchesTeachingDecision(
  context: GenerationContextPackage,
): boolean {
  const policy = context.regeneration?.authoritativePolicy
  if (policy === undefined) {
    return true
  }

  return (
    policy.teachingDecisionId === context.teachingDecision.id &&
    policy.policyVersion === context.teachingDecision.policyVersion &&
    policy.guidanceLevel === context.teachingDecision.guidanceLevel &&
    policy.revealPolicy === context.teachingDecision.revealPolicy &&
    guardPoliciesMatch(
      policy.guardPolicy,
      context.teachingDecision.guardPolicy,
    ) &&
    studentActionObligationsMatch(
      policy.studentActionObligation,
      studentActionObligationFromDecision(context.teachingDecision),
    ) &&
    outputProtectionContextsMatch(
      policy.outputProtection,
      context.outputProtection,
    )
  )
}

function studentActionObligationsMatch(
  left: StudentActionObligation,
  right: StudentActionObligation,
): boolean {
  return (
    left.required === right.required &&
    left.purpose === right.purpose &&
    left.technique === right.technique
  )
}

function outputProtectionContextsMatch(
  left: OutputProtectionContext,
  right: OutputProtectionContext,
): boolean {
  return (
    left.protectTargetSolution === right.protectTargetSolution &&
    left.topicId === right.topicId &&
    left.source === right.source
  )
}

function guardPoliciesMatch(
  left: TeachingGuardPolicy,
  right: TeachingGuardPolicy,
): boolean {
  return (
    left.preventDirectAnswer === right.preventDirectAnswer &&
    left.preventFinalResult === right.preventFinalResult &&
    left.preventCompleteSolution === right.preventCompleteSolution &&
    left.preventSubmissionReadyCode === right.preventSubmissionReadyCode &&
    left.preventProtectedCodeLeakage === right.preventProtectedCodeLeakage &&
    left.requireStudentReasoning === right.requireStudentReasoning &&
    left.requireGrounding === right.requireGrounding &&
    left.enforceCitationSupport === right.enforceCitationSupport
  )
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
      id: context.acceptedAnalysis.id,
      requestKind: context.acceptedAnalysis.result.requestKind,
      studentState: context.acceptedAnalysis.result.studentState,
      effortEvidence: context.acceptedAnalysis.result.effortEvidence,
      learningEvidence: context.acceptedAnalysis.result.learningEvidence,
      misconceptions: context.acceptedAnalysis.result.misconceptions,
      evidenceReferences: context.acceptedAnalysis.result.evidenceReferences,
      confidence: context.acceptedAnalysis.result.confidence,
      analysisSource: context.acceptedAnalysis.analysisSource,
      promptVersion: context.acceptedAnalysis.promptVersion,
      schemaVersion: context.acceptedAnalysis.schemaVersion,
    }),
    topicState: context.topicState,
    previousTeachingDecision: context.previousTeachingDecision,
    outputProtection: context.outputProtection,
    currentTeachingDecision: Object.freeze({
      id: context.teachingDecision.id,
      policyVersion: context.teachingDecision.policyVersion,
      guidanceLevel: context.teachingDecision.guidanceLevel,
      revealPolicy: context.teachingDecision.revealPolicy,
      studentActionObligation: studentActionObligationFromDecision(
        context.teachingDecision,
      ),
    }),
    recentConversation: Object.freeze(
      context.selectedHistory.map((message) =>
        Object.freeze({
          id: message.id,
          sequence: message.sequence,
          role: message.role,
          attemptId: message.attemptId,
          topicId: message.topicId,
          content: message.content,
        }),
      ),
    ),
  })
}

function toEvidenceContext(
  chunk: CourseEvidenceChunk,
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
  chunk: Pick<CourseEvidenceChunk, 'rank'>,
): string {
  return `retrieval.rank.${String(chunk.rank)}`
}

function truncateCodePoints(value: string, maximum: number): string {
  return Array.from(value).slice(0, maximum).join('')
}
