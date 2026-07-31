import {
  MessageGuidanceLabel,
  MessageRequestKind,
} from '../../generated/prisma/client'
import { assessPythonCodeDiagnosisBoundary } from './code-diagnosis/python-code-diagnosis.boundary'
import { PYTHON_CODE_DIAGNOSIS_TUTOR_DECISION } from './code-diagnosis/python-code-diagnosis.contract'
import {
  preparePythonCodeDiagnosis,
  type PythonCodeDiagnosisDraft,
} from './code-diagnosis/python-code-diagnosis.strategy'
import {
  parseTutorDecision,
  type TutorDecision,
} from './tutor-decision.contract'

const parsedGroundedDecision = parseTutorDecision({
  requestKind: MessageRequestKind.CONCEPTUAL,
  strategy: 'GROUNDED_EXPLANATION',
  hintLevel: null,
  promptVersion: 'grounded-completion-v1',
  policyVersion: 'grounded-guidance-policy-v1',
  evidenceRequirement: 'COURSE_EVIDENCE_REQUIRED',
  forbiddenOutputs: ['FINAL_ANSWER', 'INVENTED_CITATION'],
  guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
})

export const GROUNDED_EXPLANATION_TUTOR_DECISION: TutorDecision = Object.freeze(
  {
    ...parsedGroundedDecision,
    forbiddenOutputs: Object.freeze([
      ...parsedGroundedDecision.forbiddenOutputs,
    ]),
  },
)

export type TutorStrategySelection =
  | {
      readonly decision: TutorDecision
      readonly retrievalQuery: string
      readonly diagnosis: null
    }
  | {
      readonly decision: TutorDecision
      readonly retrievalQuery: string
      readonly diagnosis: Readonly<PythonCodeDiagnosisDraft>
    }

export function selectTutorStrategy(
  studentMessage: string,
): TutorStrategySelection {
  const assessment = assessPythonCodeDiagnosisBoundary(studentMessage)
  const diagnosis = preparePythonCodeDiagnosis(studentMessage, assessment)
  if (diagnosis !== null) {
    return Object.freeze({
      decision: PYTHON_CODE_DIAGNOSIS_TUTOR_DECISION,
      retrievalQuery: diagnosis.retrievalQuery,
      diagnosis: diagnosis.diagnosis,
    })
  }

  return Object.freeze({
    decision: GROUNDED_EXPLANATION_TUTOR_DECISION,
    retrievalQuery: studentMessage,
    diagnosis: null,
  })
}
