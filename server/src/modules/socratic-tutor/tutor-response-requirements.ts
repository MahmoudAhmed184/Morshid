import { MessageRequestKind, StudentState } from '../../generated/prisma/client'

import type { EducationalAnalysisResult } from './educational-analysis.types'

export const TUTOR_RESPONSE_REQUIREMENTS_VERSION =
  'tutor-response-requirements.v1'

export interface TutorResponseRequirements {
  readonly version: typeof TUTOR_RESPONSE_REQUIREMENTS_VERSION
  readonly requestKind: MessageRequestKind
  readonly guidanceLevel: number
  readonly supportedConceptualExplanation: boolean
  readonly askWhatStudentTried: boolean
  readonly smallStartingHintCount: 0 | 1
  readonly identifyLikelyMisconception: boolean
  readonly meaningfulGuidingQuestionCount: 0 | 1
  readonly acknowledgeStudentSupportedCorrectWork: boolean
  readonly identifyNextReasoningStepWithoutSolving: boolean
  readonly analogousWorkedExampleOrBoundedStrongGuidance: boolean
  readonly protectExactOriginalSolution: boolean
  readonly evaluateSemanticallyWithoutPhraseMatching: true
}

export function buildTutorResponseRequirements(input: {
  readonly analysis: Pick<
    EducationalAnalysisResult,
    'requestKind' | 'studentState' | 'effortEvidence'
  >
  readonly guidanceLevel: number
}): TutorResponseRequirements {
  const guidanceLevel = normalizeGuidanceLevel(input.guidanceLevel)
  const requestKind = input.analysis.requestKind
  const isProtectedProblem =
    requestKind === MessageRequestKind.PROBLEM_LIKE ||
    requestKind === MessageRequestKind.ATTEMPT_DIAGNOSIS ||
    requestKind === MessageRequestKind.CODE_DIAGNOSIS
  const isNoAttemptProblem =
    requestKind === MessageRequestKind.PROBLEM_LIKE &&
    !input.analysis.effortEvidence.present &&
    guidanceLevel === 1
  const isAttempt = requestKind === MessageRequestKind.ATTEMPT_DIAGNOSIS

  return Object.freeze({
    version: TUTOR_RESPONSE_REQUIREMENTS_VERSION,
    requestKind,
    guidanceLevel,
    supportedConceptualExplanation:
      requestKind === MessageRequestKind.CONCEPTUAL,
    askWhatStudentTried: isNoAttemptProblem,
    smallStartingHintCount: isNoAttemptProblem ? 1 : 0,
    identifyLikelyMisconception:
      isAttempt &&
      input.analysis.studentState === StudentState.MISCONCEPTION &&
      guidanceLevel >= 2,
    meaningfulGuidingQuestionCount: isAttempt && guidanceLevel === 2 ? 1 : 0,
    acknowledgeStudentSupportedCorrectWork:
      isAttempt &&
      input.analysis.studentState === StudentState.PARTIAL_UNDERSTANDING &&
      guidanceLevel === 3,
    identifyNextReasoningStepWithoutSolving: isAttempt && guidanceLevel === 3,
    analogousWorkedExampleOrBoundedStrongGuidance:
      isProtectedProblem && guidanceLevel === 4,
    protectExactOriginalSolution: isProtectedProblem,
    evaluateSemanticallyWithoutPhraseMatching: true,
  })
}

function normalizeGuidanceLevel(level: number): number {
  if (!Number.isSafeInteger(level)) {
    return 1
  }
  return Math.min(Math.max(level, 1), 4)
}
