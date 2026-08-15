import {
  ReflectionMode,
  RevealPolicy,
  StudentActionPurpose,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
import { DeterministicGuardService } from './deterministic-guard.service'
import {
  RESPONSE_VALIDATION_STAGE,
  RESPONSE_VIOLATION_TYPE,
  type CandidateValidationContext,
} from './response-validation.types'
import type { CandidateResponse } from '../generation/tutor-generation.types'
import { renderDebuggingGuidanceMessage } from '../debugging-guidance/debugging-guidance.output-validator'

describe('DeterministicGuardService', () => {
  it('approves a compliant Socratic response', () => {
    const result = service().evaluate(validCandidate(), context())

    expect(result).toMatchObject({
      stage: RESPONSE_VALIDATION_STAGE.DETERMINISTIC,
      approved: true,
    })
  })

  it.each([
    ['the answer is', 'The answer is 42.', 'FINAL_ANSWER_DISCLOSURE'],
    ['final answer', 'Final answer: use n + 1.', 'FINAL_ANSWER_DISCLOSURE'],
    [
      'direct final numeric result',
      'Therefore x = 7.',
      'FINAL_ANSWER_DISCLOSURE',
    ],
    [
      'complete solution',
      'Complete solution: step 1 read it. step 2 compute it. step 3 submit it.',
      'COMPLETE_SOLUTION_DISCLOSURE',
    ],
    [
      'submission-ready code',
      '```ts\nimport fs from "node:fs"\nconst first = 1\nconst second = 2\nconst total = first + second\nconsole.log(total)\n```',
      'SUBMISSION_READY_CODE',
    ],
    [
      'excessive steps',
      '1. Inspect the loop. 2. Compute the update.',
      'EXCESSIVE_DISCLOSED_STEPS',
    ],
  ])('rejects %s', (_name, message, violationType) => {
    const result = service().evaluate(validCandidate({ message }), context())

    expect(result.approved).toBe(false)
    expect(result.violations.map((violation) => violation.type)).toContain(
      violationType,
    )
  })

  it('allows a short diagnostic code snippet', () => {
    const result = service().evaluate(
      validCandidate({
        message:
          'Try tracing only this diagnostic line: `print(i, total)`. What changes first?',
      }),
      context(),
    )

    expect(result.approved).toBe(true)
  })

  it.each([
    [
      'Guidance Level violation',
      validCandidate({
        message: '1. Inspect the loop. 2. Compute the update.',
      }),
      context({ guidanceLevel: 1 }),
      RESPONSE_VIOLATION_TYPE.GUIDANCE_LEVEL_VIOLATION,
    ],
    [
      'missing student action',
      validCandidate({ requiresStudentAction: false }),
      context(),
      RESPONSE_VIOLATION_TYPE.MISSING_REQUIRED_STUDENT_ACTION,
    ],
    [
      'intent mismatch',
      validCandidate({ responseIntent: TeachingStrategy.GUIDED_EXPLANATION }),
      context(),
      RESPONSE_VIOLATION_TYPE.RESPONSE_INTENT_MISMATCH,
    ],
    [
      'technique mismatch',
      validCandidate({
        studentAction: {
          type: TeachingTechnique.TRACE_EXECUTION,
          description: 'Trace the next value.',
        },
      }),
      context(),
      RESPONSE_VIOLATION_TYPE.TECHNIQUE_MISMATCH,
    ],
    [
      'grounding violation',
      validCandidate({ usedCitationIds: ['retrieval.rank.9'] }),
      context(),
      RESPONSE_VIOLATION_TYPE.GROUNDING_VIOLATION,
    ],
    [
      'missing required citation',
      validCandidate({ usedCitationIds: [] }),
      context(),
      RESPONSE_VIOLATION_TYPE.GROUNDING_VIOLATION,
    ],
    [
      'self-reported final answer',
      validCandidate({
        selfReportedCompliance: {
          finalAnswerRevealed: true,
          completeSolutionRevealed: false,
        },
      }),
      context(),
      RESPONSE_VIOLATION_TYPE.FINAL_ANSWER_DISCLOSURE,
    ],
  ])('rejects %s', (_name, candidate, validationContext, violationType) => {
    const result = service().evaluate(candidate, validationContext)

    expect(result.approved).toBe(false)
    expect(result.violations.map((violation) => violation.type)).toContain(
      violationType,
    )
  })

  it('resists common false positives', () => {
    const result = service().evaluate(
      validCandidate({
        message:
          'A useful answer strategy is to compare one variable before and after the loop. What changes first?',
      }),
      context(),
    )

    expect(result.approved).toBe(true)
  })

  it('approves a compliant focused-question debugging response', () => {
    const result = service().evaluate(
      validDebuggingCandidate(),
      debuggingContext(),
    )

    expect(result).toMatchObject({
      stage: RESPONSE_VALIDATION_STAGE.DETERMINISTIC,
      approved: true,
      violations: [],
    })
  })

  it.each([
    [
      'diagnosis',
      { diagnosis: undefined },
      RESPONSE_VIOLATION_TYPE.DEBUGGING_MISSING_DIAGNOSIS,
    ],
    [
      'relevant location',
      { relevantLocation: undefined },
      RESPONSE_VIOLATION_TYPE.DEBUGGING_MISSING_RELEVANT_LOCATION,
    ],
    [
      'concept explanation',
      { conceptExplanation: undefined },
      RESPONSE_VIOLATION_TYPE.DEBUGGING_MISSING_CONCEPT,
    ],
  ])(
    'reports a specific missing %s subreason',
    (_name, patch, violationType) => {
      const candidate = validDebuggingCandidate()
      const baseGuidance = candidate.debuggingGuidance
      if (baseGuidance === null) {
        throw new Error('Expected structured debugging guidance')
      }
      const debuggingGuidance = {
        diagnosis: baseGuidance.diagnosis,
        relevantLocation: baseGuidance.relevantLocation,
        conceptExplanation: baseGuidance.conceptExplanation,
        ...patch,
        inspectionActions: baseGuidance.inspectionActions,
      }
      const result = service().evaluate(
        {
          ...candidate,
          debuggingGuidance,
          message: renderDebuggingGuidanceMessage({
            guidance: debuggingGuidance,
            usedCitationIds: candidate.usedCitationIds,
            action: debuggingGuidance.inspectionActions[0] ?? '',
            rewriteRequested: false,
          }),
        },
        debuggingContext(),
      )

      expect(result.approved).toBe(false)
      expect(result.violations.map((violation) => violation.type)).toContain(
        violationType,
      )
    },
  )

  it('rejects a rendered citation that disagrees with usedCitationIds', () => {
    const candidate = validDebuggingCandidate()
    const result = service().evaluate(
      {
        ...candidate,
        message: candidate.message.replace(
          '[retrieval.rank.1]',
          '[retrieval.rank.2]',
        ),
      },
      debuggingContext(),
    )

    expect(result.violations.map((violation) => violation.type)).toContain(
      RESPONSE_VIOLATION_TYPE.DEBUGGING_RENDERED_CITATION_MISMATCH,
    )
  })

  it('rejects multiple student actions even when they form one sentence', () => {
    const candidate = validDebuggingCandidate()
    const inspectionActions = [
      'Can you trace the accumulator and compare the returned value?',
    ]
    const debuggingGuidance = {
      ...candidate.debuggingGuidance,
      inspectionActions,
    }
    const result = service().evaluate(
      {
        ...candidate,
        debuggingGuidance,
        message: renderDebuggingGuidanceMessage({
          guidance: debuggingGuidance,
          usedCitationIds: candidate.usedCitationIds,
          action: inspectionActions[0],
          rewriteRequested: false,
        }),
        studentAction: {
          ...candidate.studentAction,
          description: inspectionActions[0],
        },
      },
      debuggingContext(),
    )

    expect(result.violations.map((violation) => violation.type)).toContain(
      RESPONSE_VIOLATION_TYPE.DEBUGGING_MULTIPLE_STUDENT_ACTIONS,
    )
  })

  it('keeps complete corrected programs prohibited in debugging guidance', () => {
    const candidate = validDebuggingCandidate()
    const debuggingGuidance = {
      ...candidate.debuggingGuidance,
      conceptExplanation:
        'Complete corrected program:\n```python\ndef total(values):\n    result = 0\n    for value in values:\n        result += value\n    return result\n```',
    }
    const result = service().evaluate(
      {
        ...candidate,
        debuggingGuidance,
        message: renderDebuggingGuidanceMessage({
          guidance: debuggingGuidance,
          usedCitationIds: candidate.usedCitationIds,
          action: debuggingGuidance.inspectionActions[0],
          rewriteRequested: false,
        }),
      },
      debuggingContext(),
    )

    expect(result.approved).toBe(false)
    expect(result.violations.map((violation) => violation.type)).toContain(
      RESPONSE_VIOLATION_TYPE.DEBUGGING_GUIDANCE_CONTRACT,
    )
  })
})

function service() {
  return new DeterministicGuardService()
}

function validCandidate(
  patch: Partial<CandidateResponse> = {},
): CandidateResponse {
  return {
    message:
      'Use the cited loop update and tell me what changes first. [retrieval.rank.1]',
    debuggingGuidance: null,
    responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
    usedCitationIds: ['retrieval.rank.1'],
    requiresStudentAction: true,
    studentAction: {
      type: TeachingTechnique.ORIENTATION_QUESTION,
      description: 'Identify the first value that changes before continuing.',
    },
    reflectionIncluded: false,
    selfReportedCompliance: {
      finalAnswerRevealed: false,
      completeSolutionRevealed: false,
    },
    provider: 'deterministic',
    model: 'deterministic-tutor',
    promptVersion: 'tutor-generation.mvp.v8',
    tokenUsage: { input: 0, output: 0 },
    ...patch,
  }
}

function context(
  patch: Partial<CandidateValidationContext> = {},
): CandidateValidationContext {
  return {
    allowedCitationIds: new Set(['retrieval.rank.1']),
    requireGrounding: true,
    enforceCitationSupport: true,
    studentActionObligation: {
      version: 'student-action-obligation.v1',
      required: true,
      purpose: StudentActionPurpose.PRIOR_ATTEMPT_ORIENTATION,
      technique: TeachingTechnique.ORIENTATION_QUESTION,
      maximumMeaningfulActions: 1,
      generationInstruction:
        'Ask the student to share what they tried as the single meaningful action.',
    },
    reflectionMode: ReflectionMode.NONE,
    responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    maximumDisclosedSteps: 1,
    ...patch,
  }
}

function validDebuggingCandidate(): CandidateResponse {
  const debuggingGuidance = {
    diagnosis: 'The loop update likely uses the wrong variable.',
    relevantLocation: 'Inspect the assignment inside the loop body.',
    conceptExplanation: 'An accumulator must be updated from its prior value.',
    inspectionActions: [
      'What value does the accumulator hold after one iteration?',
    ],
  }
  const action = debuggingGuidance.inspectionActions[0]

  return validCandidate({
    message: renderDebuggingGuidanceMessage({
      guidance: debuggingGuidance,
      usedCitationIds: ['retrieval.rank.1'],
      action,
      rewriteRequested: false,
    }),
    debuggingGuidance,
    studentAction: {
      type: TeachingTechnique.FOCUSED_QUESTION,
      description: action,
    },
  })
}

function debuggingContext(): CandidateValidationContext {
  return context({
    studentActionObligation: {
      ...context().studentActionObligation,
      purpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
      technique: TeachingTechnique.FOCUSED_QUESTION,
      generationInstruction:
        'Request exactly one meaningful FOCUSED_QUESTION action.',
    },
    debuggingGuidanceRequired: true,
    debuggingGuidance: {
      likelyIssue: 'The loop update likely uses the wrong variable.',
      relevantLocation: 'Inspect the assignment inside the loop body.',
      concept: 'Accumulator updates',
      nextInspectionStep: 'Trace one iteration.',
      evidenceQuery: 'accumulator update loop',
      rewriteRequested: false,
    },
  })
}
