import {
  ReflectionMode,
  RevealPolicy,
  StudentActionPurpose,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
import {
  DeterministicGuardService,
  extractProblemStatementGivensAndTargets,
} from './deterministic-guard.service'
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

  describe('target-aware solution protection', () => {
    const activeProblem = 'x = 5\ny = x + 1\nwhat is the value of y?'
    const { givenPremises, targetVariables } =
      extractProblemStatementGivensAndTargets(activeProblem)

    it('extracts trusted given premises and target variables from active problem statement', () => {
      expect(givenPremises.has('x = 5')).toBe(true)
      expect(givenPremises.has('x=5')).toBe(true)
      expect(targetVariables.has('y')).toBe(true)
      expect(givenPremises.has('y = 6')).toBe(false)
    })

    it('does not extract student attempts or guesses as given premises', () => {
      const laterStudentAttempt = 'I think y = 6'
      const extracted =
        extractProblemStatementGivensAndTargets(laterStudentAttempt)
      expect(extracted.givenPremises.has('y = 6')).toBe(false)
    })

    it('allows reference to student-provided given premise during scaffolding', () => {
      const result = service().evaluate(
        validCandidate({
          message:
            'Start with the first line: x = 5. What value is currently stored in x? [retrieval.rank.1]',
        }),
        context({ givenPremises, targetVariables }),
      )

      expect(result.approved).toBe(true)
    })

    it('allows reference to formula or expression', () => {
      const result = service().evaluate(
        validCandidate({
          message:
            'Look at y = x + 1. What does +1 tell you to do? [retrieval.rank.1]',
        }),
        context({ givenPremises, targetVariables }),
      )

      expect(result.approved).toBe(true)
    })

    it('allows unrelated intermediate numeric assignments not bound to target variable', () => {
      const result = service().evaluate(
        validCandidate({
          message:
            "Let's trace step = 1. What happens on the next line? [retrieval.rank.1]",
        }),
        context({ givenPremises, targetVariables }),
      )

      expect(result.approved).toBe(true)
    })

    it('rejects candidate performing decisive substitution derivation (x + 1 becomes 5 + 1)', () => {
      const result = service().evaluate(
        validCandidate({
          message:
            'Since x is 5, x + 1 becomes 5 + 1. What is the value? [retrieval.rank.1]',
        }),
        context({ givenPremises, targetVariables }),
      )

      expect(result.approved).toBe(false)
      expect(result.violations.map((v) => v.type)).toContain(
        RESPONSE_VIOLATION_TYPE.DIRECT_ANSWER_DISCLOSURE,
      )
    })

    it('rejects candidate performing commutative decisive substitution derivation (1 + x becomes 1 + 5)', () => {
      const result = service().evaluate(
        validCandidate({
          message:
            'Since x is 5, 1 + x becomes 1 + 5. What is the value? [retrieval.rank.1]',
        }),
        context({ givenPremises, targetVariables }),
      )

      expect(result.approved).toBe(false)
      expect(result.violations.map((v) => v.type)).toContain(
        RESPONSE_VIOLATION_TYPE.DIRECT_ANSWER_DISCLOSURE,
      )
    })

    it('rejects candidate performing decisive substitution target assignment (y = 5 + 1 and y = 1 + 5)', () => {
      const result1 = service().evaluate(
        validCandidate({
          message: 'Since x = 5, y = 5 + 1. [retrieval.rank.1]',
        }),
        context({ givenPremises, targetVariables }),
      )
      expect(result1.approved).toBe(false)
      expect(result1.violations.map((v) => v.type)).toContain(
        RESPONSE_VIOLATION_TYPE.DIRECT_ANSWER_DISCLOSURE,
      )

      const result2 = service().evaluate(
        validCandidate({
          message: 'Since x = 5, y = 1 + 5. [retrieval.rank.1]',
        }),
        context({ givenPremises, targetVariables }),
      )
      expect(result2.approved).toBe(false)
      expect(result2.violations.map((v) => v.type)).toContain(
        RESPONSE_VIOLATION_TYPE.DIRECT_ANSWER_DISCLOSURE,
      )
    })

    it('rejects candidate performing expressive substitution derivation (substituting x = 5 gives 5 + 1)', () => {
      const result = service().evaluate(
        validCandidate({
          message:
            'Substituting x = 5 gives 5 + 1. Calculate the result. [retrieval.rank.1]',
        }),
        context({ givenPremises, targetVariables }),
      )

      expect(result.approved).toBe(false)
      expect(result.violations.map((v) => v.type)).toContain(
        RESPONSE_VIOLATION_TYPE.DIRECT_ANSWER_DISCLOSURE,
      )
    })

    it('rejects candidate disclosing target variable assignment', () => {
      const result = service().evaluate(
        validCandidate({
          message: 'Since x = 5, y = 6. [retrieval.rank.1]',
        }),
        context({ givenPremises, targetVariables }),
      )

      expect(result.approved).toBe(false)
      expect(result.violations.map((v) => v.type)).toContain(
        RESPONSE_VIOLATION_TYPE.FINAL_ANSWER_DISCLOSURE,
      )
    })

    it('rejects candidate asserting final answer', () => {
      const result = service().evaluate(
        validCandidate({
          message: 'The answer is 6. [retrieval.rank.1]',
        }),
        context({ givenPremises, targetVariables }),
      )

      expect(result.approved).toBe(false)
      expect(result.violations.map((v) => v.type)).toContain(
        RESPONSE_VIOLATION_TYPE.FINAL_ANSWER_DISCLOSURE,
      )
    })

    it('rejects candidate asserting conclusion', () => {
      const result = service().evaluate(
        validCandidate({
          message: 'Therefore y = 6. [retrieval.rank.1]',
        }),
        context({ givenPremises, targetVariables }),
      )

      expect(result.approved).toBe(false)
      expect(result.violations.map((v) => v.type)).toContain(
        RESPONSE_VIOLATION_TYPE.FINAL_ANSWER_DISCLOSURE,
      )
    })
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
    if (candidate.debuggingGuidance === null) {
      throw new Error('Expected debugging guidance')
    }
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
    promptVersion: 'tutor-generation.mvp.v9',
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
