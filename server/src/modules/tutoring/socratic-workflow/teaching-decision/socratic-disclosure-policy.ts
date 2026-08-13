import { RevealPolicy } from '../../tutoring-values'

import type { TeachingGuardPolicy } from './teaching-policy.types'

export const SOCRATIC_DISCLOSURE_POLICY_VERSION =
  'socratic-disclosure-policy.v2'

export interface SocraticDisclosureContract {
  readonly guidanceLevel: number
  readonly guidanceMode:
    'ORIENTATION' | 'FOCUSED_HINT' | 'GUIDED_DECOMPOSITION' | 'STRONG_GUIDANCE'
  readonly revealPolicy: RevealPolicy
  readonly retrievedEvidenceIsDisclosurePermission: false
  readonly directTargetInferenceAllowed: boolean
  readonly intermediateResultAllowed: boolean
  readonly finalReasoningAllowed: boolean
  readonly finalAnswerAllowed: boolean
  readonly completeSolutionAllowed: boolean
  readonly requiredStudentWork: string
}

/**
 * Converts the independent Guidance Level, Reveal Policy, and guard controls
 * into one explicit disclosure contract for generation and semantic review.
 * Retrieval can support a fact without authorizing the tutor to disclose it.
 */
export function buildSocraticDisclosureContract(input: {
  readonly guidanceLevel: number
  readonly revealPolicy: RevealPolicy
  readonly guardPolicy: TeachingGuardPolicy
}): SocraticDisclosureContract {
  const guidanceLevel = normalizeGuidanceLevel(input.guidanceLevel)
  const permitsPartialResult =
    input.revealPolicy !== RevealPolicy.NO_FINAL_ANSWER
  const permitsFinalReasoning =
    input.revealPolicy === RevealPolicy.FINAL_REASONING_ALLOWED ||
    input.revealPolicy === RevealPolicy.COMPLETE_SOLUTION_ALLOWED
  const permitsCompleteSolution =
    input.revealPolicy === RevealPolicy.COMPLETE_SOLUTION_ALLOWED

  return Object.freeze({
    guidanceLevel,
    guidanceMode: guidanceMode(guidanceLevel),
    revealPolicy: input.revealPolicy,
    retrievedEvidenceIsDisclosurePermission: false,
    directTargetInferenceAllowed:
      guidanceLevel === 4 &&
      permitsFinalReasoning &&
      !input.guardPolicy.preventDirectAnswer,
    intermediateResultAllowed: guidanceLevel >= 3 && permitsPartialResult,
    finalReasoningAllowed:
      guidanceLevel === 4 &&
      permitsFinalReasoning &&
      !input.guardPolicy.preventDirectAnswer,
    finalAnswerAllowed:
      guidanceLevel === 4 &&
      permitsCompleteSolution &&
      !input.guardPolicy.preventFinalResult,
    completeSolutionAllowed:
      guidanceLevel === 4 &&
      permitsCompleteSolution &&
      !input.guardPolicy.preventCompleteSolution,
    requiredStudentWork: requiredStudentWork(guidanceLevel),
  })
}

function guidanceMode(
  guidanceLevel: number,
): SocraticDisclosureContract['guidanceMode'] {
  switch (guidanceLevel) {
    case 1:
      return 'ORIENTATION'
    case 2:
      return 'FOCUSED_HINT'
    case 3:
      return 'GUIDED_DECOMPOSITION'
    case 4:
      return 'STRONG_GUIDANCE'
  }

  return 'ORIENTATION'
}

function requiredStudentWork(guidanceLevel: number): string {
  switch (guidanceLevel) {
    case 1:
      return 'Ask the student to inspect the relevant structure or choose a starting point; do not state the target inference first.'
    case 2:
      return 'Give one focused clue about a relevant concept, condition, location, or example while preserving the target inference for the student.'
    case 3:
      return 'Carry forward established student conclusions and guide at least two connected moves in reasoning order, explaining their connection while leaving at least one meaningful reasoning step for the student. One focused hint or guiding question alone is insufficient.'
    case 4:
      return 'Provide visibly more support than Guided Decomposition through a bounded analogous worked example or near-complete connected scaffold while preserving every restriction in Reveal Policy and guard policy.'
  }

  return 'Leave one meaningful reasoning step for the student.'
}

function normalizeGuidanceLevel(guidanceLevel: number): number {
  if (!Number.isSafeInteger(guidanceLevel)) {
    return 1
  }
  return Math.min(Math.max(guidanceLevel, 1), 4)
}
