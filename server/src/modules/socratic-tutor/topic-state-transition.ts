import {
  LearningStatus,
  MisconceptionStatus,
  ResolutionEvidenceStrength,
} from '../../generated/prisma/client'
import type { MessageRequestKind } from '../../generated/prisma/client'
import {
  EFFORT_QUALITY,
  LEARNING_EVIDENCE_STRENGTH,
  type EducationalAnalysisResult,
} from './educational-analysis.types'
import type { PersistedEducationalAnalysisRecord } from './educational-analysis.repository'
import type { PersistedTeachingDecisionRecord } from './teaching-decision.repository'
import type { ApprovedResponse } from './response-validation.types'
import type { TopicStatePatch, TopicStateSnapshot } from './topic-state.types'

const MAX_TOPIC_STATE_TEXT_CODE_POINTS = 1_000

export type TopicStateTransitionAnalysis = Pick<
  PersistedEducationalAnalysisRecord,
  'studentMessageId' | 'result'
>

export interface TopicStateTransition {
  readonly expectedVersion: number
  readonly patch: TopicStatePatch
}

export function buildCompletedTopicStateTransition(input: {
  readonly topicState: TopicStateSnapshot
  readonly analysis: TopicStateTransitionAnalysis
  readonly decision: PersistedTeachingDecisionRecord
  readonly approvedResponse: ApprovedResponse
}): TopicStateTransition {
  const { analysis, decision, topicState } = input
  const result = analysis.result
  const learningStrength = result.learningEvidence.strength

  const transition: TopicStateTransition = {
    expectedVersion: topicState.version,
    patch: {
      requestKind: result.requestKind,
      studentState: result.studentState,
      activeStrategy: decision.strategy,
      primaryTechnique: decision.primaryTechnique,
      supportingTechnique: decision.supportingTechnique,
      guidanceLevel: decision.guidanceLevel,
      revealPolicy: decision.revealPolicy,
      attemptCount: topicState.attemptCount + 1,
      meaningfulAttemptCount:
        topicState.meaningfulAttemptCount + meaningfulAttemptIncrement(result),
      misconceptionStatus: misconceptionStatusFor(
        topicState,
        result.misconceptions.length,
      ),
      learningStatus: learningStatusFor(topicState, result),
      resolutionEvidenceStrength: resolutionEvidenceStrengthFor(
        topicState,
        learningStrength,
      ),
      summary: summaryFor(result),
      lastTutorQuestion: boundedText(
        input.approvedResponse.studentAction.description,
      ),
      lastStudentAction: boundedText(studentActionSummary(result)),
      resolved: topicState.resolved,
    },
  }

  validateTopicStateTransition(transition)
  return transition
}

export function buildClassifiedTopicStateTransition(input: {
  readonly topicState: TopicStateSnapshot
  readonly requestKind: MessageRequestKind
}): TopicStateTransition {
  const transition: TopicStateTransition = {
    expectedVersion: input.topicState.version,
    patch: {
      requestKind: input.requestKind,
      summary: `Request classified as ${input.requestKind}.`,
      lastTutorQuestion: null,
      lastStudentAction: null,
    },
  }

  validateTopicStateTransition(transition)
  return transition
}

export function validateTopicStateTransition(
  transition: TopicStateTransition,
): void {
  if (
    !Number.isSafeInteger(transition.expectedVersion) ||
    transition.expectedVersion < 1 ||
    Object.keys(transition.patch).length === 0
  ) {
    throw new Error('Invalid TopicState transition')
  }

  for (const field of [
    'guidanceLevel',
    'attemptCount',
    'meaningfulAttemptCount',
  ] as const) {
    const value = transition.patch[field]
    if (
      value !== undefined &&
      (!Number.isSafeInteger(value) ||
        value < 0 ||
        (field === 'guidanceLevel' && value > 4))
    ) {
      throw new Error(`Invalid TopicState transition field: ${field}`)
    }
  }

  for (const field of [
    'summary',
    'lastTutorQuestion',
    'lastStudentAction',
  ] as const) {
    const value = transition.patch[field]
    if (
      value !== undefined &&
      value !== null &&
      codePointLength(value) > MAX_TOPIC_STATE_TEXT_CODE_POINTS
    ) {
      throw new Error(`Invalid TopicState transition field: ${field}`)
    }
  }
}

function meaningfulAttemptIncrement(result: EducationalAnalysisResult): number {
  return result.effortEvidence.present &&
    (result.effortEvidence.quality === EFFORT_QUALITY.MEANINGFUL ||
      result.effortEvidence.quality === EFFORT_QUALITY.STRONG)
    ? 1
    : 0
}

function misconceptionStatusFor(
  topicState: TopicStateSnapshot,
  misconceptionCount: number,
) {
  return misconceptionCount > 0
    ? MisconceptionStatus.ACTIVE
    : topicState.misconceptionStatus
}

function learningStatusFor(
  topicState: TopicStateSnapshot,
  result: EducationalAnalysisResult,
): LearningStatus {
  if (result.learningEvidence.present) {
    switch (result.learningEvidence.strength) {
      case LEARNING_EVIDENCE_STRENGTH.STRONG:
        return LearningStatus.VERIFIED
      case LEARNING_EVIDENCE_STRENGTH.MODERATE:
        return LearningStatus.DEMONSTRATED
      case LEARNING_EVIDENCE_STRENGTH.WEAK:
        return LearningStatus.IN_PROGRESS
      case LEARNING_EVIDENCE_STRENGTH.NONE:
        break
    }
  }

  return result.effortEvidence.present
    ? LearningStatus.IN_PROGRESS
    : topicState.learningStatus
}

function resolutionEvidenceStrengthFor(
  topicState: TopicStateSnapshot,
  currentStrength: EducationalAnalysisResult['learningEvidence']['strength'],
): ResolutionEvidenceStrength {
  const current = toResolutionEvidenceStrength(currentStrength)
  return evidenceStrengthRank(current) >=
    evidenceStrengthRank(topicState.resolutionEvidenceStrength)
    ? current
    : topicState.resolutionEvidenceStrength
}

function toResolutionEvidenceStrength(
  strength: EducationalAnalysisResult['learningEvidence']['strength'],
): ResolutionEvidenceStrength {
  switch (strength) {
    case LEARNING_EVIDENCE_STRENGTH.STRONG:
      return ResolutionEvidenceStrength.STRONG
    case LEARNING_EVIDENCE_STRENGTH.MODERATE:
      return ResolutionEvidenceStrength.MODERATE
    case LEARNING_EVIDENCE_STRENGTH.WEAK:
      return ResolutionEvidenceStrength.WEAK
    case LEARNING_EVIDENCE_STRENGTH.NONE:
      return ResolutionEvidenceStrength.NONE
  }
}

function evidenceStrengthRank(strength: ResolutionEvidenceStrength): number {
  switch (strength) {
    case ResolutionEvidenceStrength.NONE:
      return 0
    case ResolutionEvidenceStrength.WEAK:
      return 1
    case ResolutionEvidenceStrength.MODERATE:
      return 2
    case ResolutionEvidenceStrength.STRONG:
      return 3
  }
}

function summaryFor(result: EducationalAnalysisResult): string {
  const misconception = result.misconceptions.at(0)
  if (misconception !== undefined) {
    return boundedText(
      `Misconception ${misconception.code}: ${misconception.description}`,
    )
  }

  if (result.learningEvidence.present) {
    return `Learning evidence: ${result.learningEvidence.strength}.`
  }

  return `Student state: ${result.studentState}.`
}

function studentActionSummary(result: EducationalAnalysisResult): string {
  if (!result.effortEvidence.present) {
    return 'No student attempt detected.'
  }

  const effortType = result.effortEvidence.type
    ?.replaceAll('_', ' ')
    .toLowerCase()
  return effortType === undefined
    ? `Student effort: ${result.effortEvidence.quality.toLowerCase()}.`
    : `Student effort: ${result.effortEvidence.quality.toLowerCase()} ${effortType}.`
}

function boundedText(value: string): string {
  return Array.from(value).slice(0, MAX_TOPIC_STATE_TEXT_CODE_POINTS).join('')
}

function codePointLength(value: string): number {
  return Array.from(value).length
}
