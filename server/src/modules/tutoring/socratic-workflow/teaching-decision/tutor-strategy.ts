import { MessageGuidanceLabel, MessageRequestKind } from '../../tutoring-values'
import {
  assessDebuggingGuidanceBoundary,
  isRejectedDebuggingGuidanceBoundaryAssessment,
} from '../debugging-guidance/debugging-guidance.boundary'
import {
  buildDebuggingGuidanceBoundaryResponse,
  type DebuggingGuidanceBoundaryResponse,
} from '../debugging-guidance/debugging-guidance.boundary-response'
import { DEBUGGING_GUIDANCE_TUTOR_DECISION } from '../debugging-guidance/debugging-guidance.contract'
import {
  assessDebuggingAdmission,
  type DebuggingGuidanceDraft,
} from '../debugging-guidance/debugging-guidance.strategy'
import type { EducationalAnalysisResult } from '../analysis/educational-analysis.types'
import type { DebuggingGuidanceRetrievalQueryInput } from '../debugging-guidance/debugging-guidance-retrieval-query'
import {
  parseTutorDecision,
  type TutorDecision,
} from './tutor-decision.contract'

const parsedGroundedDecision = parseTutorDecision({
  requestKind: MessageRequestKind.CONCEPTUAL,
  strategy: 'GROUNDED_EXPLANATION',
  hintLevel: null,
  promptVersion: 'grounded-explanation-v1',
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
    promptVersion: 'debugging-guidance-prompt-v1',
    policyVersion: 'debugging-guidance-policy-v1',
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

const DEBUGGING_GUIDANCE_BOUNDARY_DECISIONS = Object.freeze({
  AMBIGUOUS: safeRefusalDecision(MessageRequestKind.AMBIGUOUS),
  CODE_DIAGNOSIS: safeRefusalDecision(MessageRequestKind.CODE_DIAGNOSIS),
  OFF_TOPIC: safeRefusalDecision(MessageRequestKind.OFF_TOPIC),
})

export interface TutorStrategySelection {
  readonly decision: TutorDecision
  readonly retrievalQuery: string | null
  readonly diagnosis: Readonly<DebuggingGuidanceDraft> | null
  readonly suspectedCategory:
    DebuggingGuidanceRetrievalQueryInput['suspectedCategory'] | null
  readonly boundaryResponse: DebuggingGuidanceBoundaryResponse | null
  readonly fullRewriteRequested: boolean
}

export interface SelectTutorStrategyInput {
  readonly studentMessage: string
  readonly analysis?: Pick<
    EducationalAnalysisResult,
    'requestKind' | 'studentState'
  > | null
}

export function selectTutorStrategy(
  input: SelectTutorStrategyInput | string,
): TutorStrategySelection {
  const studentMessage =
    typeof input === 'string' ? input : input.studentMessage
  const analysis = typeof input === 'string' ? null : input.analysis
  const admission = assessDebuggingAdmission({ studentMessage, analysis })

  if (admission.eligible) {
    const assessment = assessDebuggingGuidanceBoundary(studentMessage)
    if (isRejectedDebuggingGuidanceBoundaryAssessment(assessment)) {
      const decision = (() => {
        switch (assessment.state) {
          case 'TOO_MANY_LINES':
          case 'UNSUPPORTED_SCOPE':
            return DEBUGGING_GUIDANCE_BOUNDARY_DECISIONS.CODE_DIAGNOSIS
          default:
            throw new TypeError('Unsupported debugging guidance boundary')
        }
      })()

      return Object.freeze({
        decision,
        retrievalQuery: null,
        diagnosis: null,
        suspectedCategory: null,
        boundaryResponse: buildDebuggingGuidanceBoundaryResponse(assessment),
        fullRewriteRequested: false,
      })
    }

    return Object.freeze({
      decision: DEBUGGING_GUIDANCE_TUTOR_DECISION,
      retrievalQuery: null,
      diagnosis: null,
      suspectedCategory: null,
      boundaryResponse: null,
      fullRewriteRequested: admission.rewriteRequested,
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
