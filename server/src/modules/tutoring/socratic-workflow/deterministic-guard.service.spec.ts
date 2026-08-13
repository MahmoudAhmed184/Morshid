import {
  ReflectionMode,
  RevealPolicy,
  TeachingStrategy,
  TeachingTechnique,
} from '../tutoring-values'
import { DeterministicGuardService } from './deterministic-guard.service'
import {
  RESPONSE_VALIDATION_STAGE,
  RESPONSE_VIOLATION_TYPE,
  type CandidateValidationContext,
} from './response-validation.types'
import type { CandidateResponse } from './tutor-generation.types'

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
    promptVersion: 'tutor-generation.mvp.v4',
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
    requireStudentAction: true,
    reflectionMode: ReflectionMode.NONE,
    responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
    primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    maximumDisclosedSteps: 1,
    ...patch,
  }
}
