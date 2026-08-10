import {
  MessageGuidanceLabel,
  MessageRequestKind,
} from '../../generated/prisma/client'
import {
  assessPythonCodeDiagnosisBoundary,
  isRejectedPythonCodeDiagnosisBoundaryAssessment,
  type RejectedPythonCodeDiagnosisBoundaryAssessment,
} from './code-diagnosis/python-code-diagnosis.boundary'
import {
  buildPythonCodeDiagnosisBoundaryResponse,
  type PythonCodeDiagnosisBoundaryResponse,
} from './code-diagnosis/python-code-diagnosis.boundary-response'
import { PYTHON_CODE_DIAGNOSIS_TUTOR_DECISION } from './code-diagnosis/python-code-diagnosis.contract'
import { requestsFullCorrectedProgram } from './code-diagnosis/python-code-diagnosis.rewrite-policy'
import {
  hasPythonCodeDiagnosisIntent,
  preparePythonCodeDiagnosis,
  type PythonCodeDiagnosisDraft,
} from './code-diagnosis/python-code-diagnosis.strategy'
import type { PythonDiagnosisRetrievalQueryInput } from './code-diagnosis/python-diagnosis-retrieval-query'
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

function safeRefusalDecision(
  requestKind:
    | typeof MessageRequestKind.AMBIGUOUS
    | typeof MessageRequestKind.CODE_DIAGNOSIS
    | typeof MessageRequestKind.OFF_TOPIC,
): TutorDecision {
  const parsed = parseTutorDecision({
    requestKind,
    strategy: 'SAFE_REFUSAL',
    hintLevel: null,
    promptVersion: 'python-code-diagnosis-prompt-v1',
    policyVersion: 'python-code-diagnosis-policy-v1',
    evidenceRequirement: 'NO_EVIDENCE',
    forbiddenOutputs: [
      'FULL_CORRECTED_CODE',
      'PROMPT_DISCLOSURE',
      'EXECUTION_CLAIM',
      'INVENTED_CITATION',
    ],
    guidanceLabel: MessageGuidanceLabel.REFUSAL,
  })

  return Object.freeze({
    ...parsed,
    forbiddenOutputs: Object.freeze([...parsed.forbiddenOutputs]),
  })
}

const PYTHON_DIAGNOSIS_BOUNDARY_DECISIONS = Object.freeze({
  AMBIGUOUS: safeRefusalDecision(MessageRequestKind.AMBIGUOUS),
  CODE_DIAGNOSIS: safeRefusalDecision(MessageRequestKind.CODE_DIAGNOSIS),
  OFF_TOPIC: safeRefusalDecision(MessageRequestKind.OFF_TOPIC),
})

export type TutorStrategySelection =
  | {
      readonly decision: TutorDecision
      readonly retrievalQuery: string
      readonly diagnosis: null
      readonly suspectedCategory: null
      readonly boundaryResponse: null
      readonly fullRewriteRequested: false
    }
  | {
      readonly decision: TutorDecision
      readonly retrievalQuery: string
      readonly diagnosis: Readonly<PythonCodeDiagnosisDraft>
      readonly suspectedCategory: PythonDiagnosisRetrievalQueryInput['suspectedCategory']
      readonly boundaryResponse: null
      readonly fullRewriteRequested: boolean
    }
  | {
      readonly decision: TutorDecision
      readonly retrievalQuery: null
      readonly diagnosis: null
      readonly suspectedCategory: null
      readonly boundaryResponse: PythonCodeDiagnosisBoundaryResponse
      readonly fullRewriteRequested: false
    }

export function selectTutorStrategy(
  studentMessage: string,
): TutorStrategySelection {
  const assessment = assessPythonCodeDiagnosisBoundary(studentMessage)
  if (
    isRejectedPythonCodeDiagnosisBoundaryAssessment(assessment) &&
    shouldApplyCodeDiagnosisBoundary(studentMessage, assessment)
  ) {
    const decision = (() => {
      switch (assessment.state) {
        case 'CLEARLY_NON_PYTHON':
          return PYTHON_DIAGNOSIS_BOUNDARY_DECISIONS.OFF_TOPIC
        case 'INSUFFICIENT_INFORMATION':
          return PYTHON_DIAGNOSIS_BOUNDARY_DECISIONS.AMBIGUOUS
        case 'TOO_MANY_LINES':
        case 'UNSUPPORTED_SCOPE':
          return PYTHON_DIAGNOSIS_BOUNDARY_DECISIONS.CODE_DIAGNOSIS
        default:
          throw new TypeError('Unsupported Python diagnosis boundary')
      }
    })()

    return Object.freeze({
      decision,
      retrievalQuery: null,
      diagnosis: null,
      suspectedCategory: null,
      boundaryResponse: buildPythonCodeDiagnosisBoundaryResponse(assessment),
      fullRewriteRequested: false,
    })
  }

  const diagnosis = preparePythonCodeDiagnosis(studentMessage, assessment)
  if (diagnosis !== null) {
    return Object.freeze({
      decision: PYTHON_CODE_DIAGNOSIS_TUTOR_DECISION,
      retrievalQuery: diagnosis.retrievalQuery,
      diagnosis: diagnosis.diagnosis,
      suspectedCategory: diagnosis.suspectedCategory,
      boundaryResponse: null,
      fullRewriteRequested: requestsFullCorrectedProgram(studentMessage),
    })
  }

  return Object.freeze({
    decision: GROUNDED_EXPLANATION_TUTOR_DECISION,
    retrievalQuery: studentMessage,
    diagnosis: null,
    suspectedCategory: null,
    boundaryResponse: null,
    fullRewriteRequested: false,
  })
}

function shouldApplyCodeDiagnosisBoundary(
  studentMessage: string,
  assessment: RejectedPythonCodeDiagnosisBoundaryAssessment,
): boolean {
  if (assessment.state === 'CLEARLY_NON_PYTHON') {
    return hasPythonCodeDiagnosisIntent(studentMessage, assessment)
  }
  return (
    assessment.state !== 'INSUFFICIENT_INFORMATION' ||
    hasPythonCodeDiagnosisIntent(studentMessage, assessment)
  )
}
