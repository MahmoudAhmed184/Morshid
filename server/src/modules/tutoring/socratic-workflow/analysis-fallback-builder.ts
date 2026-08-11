import { Injectable } from '@nestjs/common'

import {
  MessageRequestKind,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../../../generated/prisma/client'
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
import { TOPIC_RESOLUTION_OUTCOME } from './topic.types'

export const ANALYSIS_FALLBACK_PROVIDER = 'backend'
export const ANALYSIS_FALLBACK_MODEL = 'analysis-fallback-builder-v1'
export const FALLBACK_ANALYSIS_CONFIDENCE = 0.1

@Injectable()
export class AnalysisFallbackBuilder {
  build(context: AnalysisContextPackage): EducationalAnalysisResult {
    return {
      requestKind: deterministicRequestKind(context),
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
      topicRelation: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
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
): MessageRequestKind {
  const requestKind = context.studentMessage.requestKind
  return requestKind !== null &&
    SUPPORTED_EDUCATIONAL_ANALYSIS_REQUEST_KINDS.includes(requestKind)
    ? requestKind
    : MessageRequestKind.AMBIGUOUS
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
