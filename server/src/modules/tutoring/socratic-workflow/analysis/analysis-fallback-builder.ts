import { Injectable } from '@nestjs/common'

import {
  MessageRequestKind,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
  TopicStatus,
  TopicType,
} from '../../tutoring-values'
import type { AnalysisContextPackage } from './analysis-context.types'
import {
  SUPPORTED_EDUCATIONAL_ANALYSIS_REQUEST_KINDS,
  SUPPORTED_RECOMMENDED_TEACHING_STRATEGIES,
  SUPPORTED_RECOMMENDED_TEACHING_TECHNIQUES,
} from './educational-analysis.schema'
import {
  EFFORT_QUALITY,
  LEARNING_EVIDENCE_STRENGTH,
  type EducationalAnalysisResult,
} from './educational-analysis.types'
import {
  TOPIC_RESOLUTION_OUTCOME,
  type TopicResolutionOutcome,
} from '../topic/topic.types'

export const ANALYSIS_FALLBACK_PROVIDER = 'backend'
export const ANALYSIS_FALLBACK_MODEL = 'analysis-fallback-builder-v1'
export const FALLBACK_ANALYSIS_CONFIDENCE = 0.1

@Injectable()
export class AnalysisFallbackBuilder {
  build(context: AnalysisContextPackage): EducationalAnalysisResult {
    const isExplicitConceptSwitch = isExplicitStandaloneConceptInquiry(context)
    const requestKind = deterministicRequestKind(
      context,
      isExplicitConceptSwitch,
    )
    const topicRelation = deterministicTopicRelation(
      context,
      isExplicitConceptSwitch,
    )

    return {
      requestKind,
      studentState: StudentState.UNKNOWN,
      effortEvidence: {
        present: false,
        quality: EFFORT_QUALITY.NONE,
        type: null,
        addressesPreviousTutorAction: false,
        isRepeated: false,
        evidenceMessageIds: [],
      },
      learningEvidence: {
        present: false,
        strength: LEARNING_EVIDENCE_STRENGTH.NONE,
        evidenceMessageIds: [],
      },
      misconceptions: [],
      topicRelation,
      recommendedStrategy: safePreviousStrategy(context),
      recommendedTechnique: safePreviousTechnique(context),
      recommendedGuidanceLevel: 1,
      confidence: FALLBACK_ANALYSIS_CONFIDENCE,
      evidenceReferences: [context.studentMessage.id],
    }
  }
}

function deterministicRequestKind(
  context: AnalysisContextPackage,
  isExplicitConceptSwitch: boolean,
): MessageRequestKind {
  const trustedKind = context.studentMessage.requestKind
  if (
    trustedKind !== null &&
    SUPPORTED_EDUCATIONAL_ANALYSIS_REQUEST_KINDS.includes(trustedKind)
  ) {
    return trustedKind
  }

  if (isExplicitConceptSwitch) {
    return MessageRequestKind.CONCEPTUAL
  }

  if (hasActiveProblemContext(context)) {
    const topicStateKind = context.topicState?.requestKind
    if (
      topicStateKind !== undefined &&
      topicStateKind !== null &&
      SUPPORTED_EDUCATIONAL_ANALYSIS_REQUEST_KINDS.includes(topicStateKind)
    ) {
      return topicStateKind
    }
    return MessageRequestKind.PROBLEM_LIKE
  }

  if (
    context.activeTopic.topicType === TopicType.CONCEPT ||
    context.conceptMetadata !== null ||
    context.topicState?.requestKind === MessageRequestKind.CONCEPTUAL
  ) {
    return MessageRequestKind.CONCEPTUAL
  }

  return MessageRequestKind.AMBIGUOUS
}

function deterministicTopicRelation(
  context: AnalysisContextPackage,
  isExplicitConceptSwitch: boolean,
): TopicResolutionOutcome {
  if (isExplicitConceptSwitch && hasActiveProblemContext(context)) {
    return TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC
  }
  return TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC
}

function hasActiveProblemContext(context: AnalysisContextPackage): boolean {
  if (context.activeTopic.topicType === TopicType.PROBLEM) {
    return true
  }
  if (context.activeTopic.problemId !== null) {
    return true
  }
  if (context.problemMetadata !== null) {
    return true
  }
  if (
    context.topicState !== null &&
    !context.topicState.resolved &&
    (context.topicState.requestKind === MessageRequestKind.PROBLEM_LIKE ||
      context.topicState.requestKind === MessageRequestKind.ATTEMPT_DIAGNOSIS ||
      context.topicState.requestKind === MessageRequestKind.CODE_DIAGNOSIS)
  ) {
    return true
  }
  if (
    context.previousTeachingDecision !== null &&
    context.activeTopic.status === TopicStatus.ACTIVE
  ) {
    return true
  }
  if (
    context.previousTutorQuestion !== null ||
    context.previousStudentAttempt !== null
  ) {
    return true
  }
  return false
}

function isProblemContinuation(
  content: string,
  context?: AnalysisContextPackage,
): boolean {
  const normalized = content.trim().toLowerCase()
  if (normalized.length === 0) {
    return false
  }

  // Struggle / uncertainty expressions
  if (
    /\b(?:i don't know|i still don't know|idk|not sure|stuck|lost|help|confused|no idea|cannot figure|can't figure|don't understand|do not understand)\b/iu.test(
      normalized,
    )
  ) {
    return true
  }

  // Deictic clarification or repeat explanation requests referencing the ongoing task
  if (
    /\b(?:that|this|it|again|what you said|that part|step|the line|my code|here|why|how come|what about|mean by that)\b/iu.test(
      normalized,
    )
  ) {
    return true
  }

  // Step progression requests
  if (
    /\b(?:next step|what next|what do i do|what should i do|how do i continue|how to solve|what is step|where do i start|how to start)\b/iu.test(
      normalized,
    )
  ) {
    return true
  }

  // References to active problem context or ongoing tutor questions
  if (
    context !== undefined &&
    context.previousTutorQuestion !== null &&
    !isStandaloneConceptQuery(normalized)
  ) {
    return true
  }

  return false
}

function isStandaloneConceptQuery(normalized: string): boolean {
  const cleaned = normalized.replace(/[?!.,;]+$/u, '').trim()
  const conceptPattern =
    /\b(?:variables?|functions?|classes|objects?|methods?|loops?|arrays?|lists?|dictionar(?:y|ies)|tuples?|recursion|polymorphism|inheritance|scopes?|closures?|types?|pointers?|strings?|integers?|booleans?|python|javascript|typescript)\b/iu

  const inquiryPattern =
    /^(?:what\s+is\s+(?:(?:a|an|the|the\s+concept\s+of)\s+)?|explain\s+(?:(?:a|an|the|the\s+concept\s+of|what\s+is)\s+)?|difference\s+between\s+)/iu

  return inquiryPattern.test(cleaned) && conceptPattern.test(cleaned)
}

function isExplicitStandaloneConceptInquiry(
  context: AnalysisContextPackage,
): boolean {
  const content = context.studentMessage.content.trim()
  if (isProblemContinuation(content, context)) {
    return false
  }

  const normalized = content.toLowerCase()
  return isStandaloneConceptQuery(normalized)
}

function safePreviousStrategy(
  context: AnalysisContextPackage,
): TeachingStrategy {
  const previousStrategy = context.previousTeachingDecision?.activeStrategy
  return previousStrategy !== undefined &&
    previousStrategy !== null &&
    SUPPORTED_RECOMMENDED_TEACHING_STRATEGIES.includes(previousStrategy)
    ? previousStrategy
    : TeachingStrategy.SOCRATIC_QUESTIONING
}

function safePreviousTechnique(
  context: AnalysisContextPackage,
): TeachingTechnique {
  const previousTechnique = context.previousTeachingDecision?.primaryTechnique
  return previousTechnique !== undefined &&
    previousTechnique !== null &&
    SUPPORTED_RECOMMENDED_TEACHING_TECHNIQUES.includes(previousTechnique)
    ? previousTechnique
    : TeachingTechnique.ORIENTATION_QUESTION
}
