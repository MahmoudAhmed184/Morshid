import {
  MessageGuidanceLabel,
  MessageRequestKind,
} from '../../../generated/prisma/client'
import {
  assessDebuggingGuidanceBoundary,
  isRejectedDebuggingGuidanceBoundaryAssessment,
  type RejectedDebuggingGuidanceBoundaryAssessment,
} from './debugging-guidance/debugging-guidance.boundary'
import {
  buildDebuggingGuidanceBoundaryResponse,
  type DebuggingGuidanceBoundaryResponse,
} from './debugging-guidance/debugging-guidance.boundary-response'
import { DEBUGGING_GUIDANCE_TUTOR_DECISION } from './debugging-guidance/debugging-guidance.contract'
import { requestsFullCorrectedProgram } from './debugging-guidance/debugging-guidance.rewrite-policy'
import {
  hasDebuggingGuidanceIntent,
  prepareDebuggingGuidance,
  type DebuggingGuidanceDraft,
} from './debugging-guidance/debugging-guidance.strategy'
import type { DebuggingGuidanceRetrievalQueryInput } from './debugging-guidance/debugging-guidance-retrieval-query'
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
      readonly diagnosis: Readonly<DebuggingGuidanceDraft>
      readonly suspectedCategory: DebuggingGuidanceRetrievalQueryInput['suspectedCategory']
      readonly boundaryResponse: null
      readonly fullRewriteRequested: boolean
    }
  | {
      readonly decision: TutorDecision
      readonly retrievalQuery: null
      readonly diagnosis: null
      readonly suspectedCategory: null
      readonly boundaryResponse: DebuggingGuidanceBoundaryResponse
      readonly fullRewriteRequested: false
    }

export function selectTutorStrategy(
  studentMessage: string,
): TutorStrategySelection {
  const assessment = assessDebuggingGuidanceBoundary(studentMessage)
  if (
    isRejectedDebuggingGuidanceBoundaryAssessment(assessment) &&
    shouldApplyCodeDiagnosisBoundary(studentMessage, assessment)
  ) {
    const decision = (() => {
      switch (assessment.state) {
        case 'UNSUPPORTED_LANGUAGE':
          return DEBUGGING_GUIDANCE_BOUNDARY_DECISIONS.OFF_TOPIC
        case 'INSUFFICIENT_INFORMATION':
          return DEBUGGING_GUIDANCE_BOUNDARY_DECISIONS.AMBIGUOUS
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

  const diagnosis = prepareDebuggingGuidance(studentMessage, assessment)
  if (diagnosis !== null) {
    return Object.freeze({
      decision: DEBUGGING_GUIDANCE_TUTOR_DECISION,
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
  assessment: RejectedDebuggingGuidanceBoundaryAssessment,
): boolean {
  if (assessment.state === 'UNSUPPORTED_LANGUAGE') {
    return hasDebuggingGuidanceIntent(studentMessage, assessment)
  }
  return (
    assessment.state !== 'INSUFFICIENT_INFORMATION' ||
    hasDebuggingGuidanceIntent(studentMessage, assessment)
  )
}
