import { MessageRequestKind, StudentState } from '../../tutoring-values'

import type { EducationalAnalysisResult } from '../analysis/educational-analysis.types'
import { isDirectConceptualAnalysis } from '../teaching-decision/direct-conceptual-policy'

export const TUTOR_RESPONSE_REQUIREMENTS_VERSION =
  'tutor-response-requirements.v3'

export type TutorGuidanceMode =
  'ORIENTATION' | 'FOCUSED_HINT' | 'GUIDED_DECOMPOSITION' | 'STRONG_GUIDANCE'

export interface TutorGuidanceShapeRequirements {
  readonly mode: TutorGuidanceMode
  readonly minimumConnectedScaffoldMoves: 0 | 1 | 2 | 3
  readonly orderedDecompositionRequired: boolean
  readonly preserveEstablishedIntermediateConclusions: boolean
  readonly explainConnectionsBetweenScaffoldMoves: boolean
  readonly singleGuidingQuestionIsSufficient: boolean
  readonly analogousExampleOrNearCompleteScaffoldRequired: boolean
  readonly residualStudentWork: string
  readonly generationInstruction: string
}

export interface TutorResponseRequirements {
  readonly version: typeof TUTOR_RESPONSE_REQUIREMENTS_VERSION
  readonly requestKind: MessageRequestKind
  readonly guidanceLevel: number
  readonly guidanceShape: TutorGuidanceShapeRequirements
  readonly strategyAndTechniqueMustNotReduceGuidanceShape: true
  readonly minimumUsefulConceptualExplanationRequired: boolean
  readonly conceptualUnderstandingCheckRequired: boolean
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
    'requestKind' | 'studentState' | 'effortEvidence' | 'misconceptions'
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
  const isDirectConceptual = isDirectConceptualAnalysis(input.analysis)

  return Object.freeze({
    version: TUTOR_RESPONSE_REQUIREMENTS_VERSION,
    requestKind,
    guidanceLevel,
    guidanceShape: guidanceShapeRequirements(guidanceLevel, isDirectConceptual),
    strategyAndTechniqueMustNotReduceGuidanceShape: true,
    minimumUsefulConceptualExplanationRequired: isDirectConceptual,
    conceptualUnderstandingCheckRequired: isDirectConceptual,
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

function guidanceShapeRequirements(
  guidanceLevel: number,
  directConceptual = false,
): TutorGuidanceShapeRequirements {
  switch (guidanceLevel) {
    case 1:
      return Object.freeze({
        mode: 'ORIENTATION',
        minimumConnectedScaffoldMoves: 0,
        orderedDecompositionRequired: false,
        preserveEstablishedIntermediateConclusions: false,
        explainConnectionsBetweenScaffoldMoves: false,
        singleGuidingQuestionIsSufficient: true,
        analogousExampleOrNearCompleteScaffoldRequired: false,
        residualStudentWork: directConceptual
          ? 'The student applies, compares, predicts from, or reflects on the stated core concept.'
          : 'The student chooses a starting point or identifies the relevant structure.',
        generationInstruction: directConceptual
          ? 'State the minimum useful grounded core concept without over-explaining, then ask one meaningful understanding or application question.'
          : 'Orient the student to the task or a starting point without supplying the target inference.',
      })
    case 2:
      return Object.freeze({
        mode: 'FOCUSED_HINT',
        minimumConnectedScaffoldMoves: 1,
        orderedDecompositionRequired: false,
        preserveEstablishedIntermediateConclusions: false,
        explainConnectionsBetweenScaffoldMoves: false,
        singleGuidingQuestionIsSufficient: true,
        analogousExampleOrNearCompleteScaffoldRequired: false,
        residualStudentWork:
          'The student infers the target correction or next reasoning step from one focused clue.',
        generationInstruction:
          'Give one focused clue about the relevant concept, condition, location, or example, then request one meaningful student reasoning action.',
      })
    case 3:
      return Object.freeze({
        mode: 'GUIDED_DECOMPOSITION',
        minimumConnectedScaffoldMoves: 2,
        orderedDecompositionRequired: true,
        preserveEstablishedIntermediateConclusions: true,
        explainConnectionsBetweenScaffoldMoves: true,
        singleGuidingQuestionIsSufficient: false,
        analogousExampleOrNearCompleteScaffoldRequired: false,
        residualStudentWork:
          'The student completes at least one meaningful reasoning step after the ordered scaffold.',
        generationInstruction:
          'Carry forward conclusions the student has already established, then provide at least two connected scaffold moves in reasoning order and explain how they connect. End with one meaningful step for the student. A confirmation plus one guiding question, or one focused hint plus one question, is insufficient. The ordered scaffold need not be numbered and must remain within Reveal Policy and guard limits.',
      })
    case 4:
      return Object.freeze({
        mode: 'STRONG_GUIDANCE',
        minimumConnectedScaffoldMoves: 3,
        orderedDecompositionRequired: true,
        preserveEstablishedIntermediateConclusions: true,
        explainConnectionsBetweenScaffoldMoves: true,
        singleGuidingQuestionIsSufficient: false,
        analogousExampleOrNearCompleteScaffoldRequired: true,
        residualStudentWork:
          'The student completes the protected final inference, result, or implementation work required by Reveal Policy and guard policy.',
        generationInstruction:
          'Provide visibly more support than Guided Decomposition through a bounded analogous worked example or a near-complete connected scaffold. Preserve established conclusions and intermediate connections, but leave every answer, result, code, or solution element protected by Reveal Policy and guard policy for the student.',
      })
  }

  return guidanceShapeRequirements(1)
}

function normalizeGuidanceLevel(level: number): number {
  if (!Number.isSafeInteger(level)) {
    return 1
  }
  return Math.min(Math.max(level, 1), 4)
}
