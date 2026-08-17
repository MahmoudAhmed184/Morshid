import {
  StudentActionPurpose,
  type TeachingTechnique,
} from '../../tutoring-values'
import type { PersistedTeachingDecisionRecord } from './teaching-decision.repository'

export const STUDENT_ACTION_OBLIGATION_VERSION = 'student-action-obligation.v1'

export interface StudentActionObligation {
  readonly version: typeof STUDENT_ACTION_OBLIGATION_VERSION
  readonly required: boolean
  readonly purpose: StudentActionPurpose
  readonly technique: TeachingTechnique
  readonly maximumMeaningfulActions: 1
  readonly generationInstruction: string
}

export function studentActionObligationFromDecision(
  decision: Pick<
    PersistedTeachingDecisionRecord,
    'requireStudentAction' | 'studentActionPurpose' | 'primaryTechnique'
  >,
): StudentActionObligation {
  return Object.freeze({
    version: STUDENT_ACTION_OBLIGATION_VERSION,
    required: decision.requireStudentAction,
    purpose: decision.studentActionPurpose,
    technique: decision.primaryTechnique,
    maximumMeaningfulActions: 1,
    generationInstruction: generationInstruction(
      decision.studentActionPurpose,
      decision.primaryTechnique,
    ),
  })
}

function generationInstruction(
  purpose: StudentActionPurpose,
  technique: TeachingTechnique,
): string {
  switch (purpose) {
    case StudentActionPurpose.PRIOR_ATTEMPT_ORIENTATION:
      return 'Ask the student to share what they tried as the single meaningful action. A small starting hint may support that action, but must not add another student task.'
    case StudentActionPurpose.CONCEPTUAL_UNDERSTANDING:
      return 'After the bounded conceptual explanation, ask one meaningful comparison, prediction, application, or reflection question.'
    case StudentActionPurpose.PRIMARY_TECHNIQUE:
      return `Request exactly one meaningful ${technique} action. Do not add an independent prior-attempt question.`
  }
}
