import { TeachingStrategy, TeachingTechnique } from '../../tutoring-values'
import type {
  CandidateResponse,
  TutorDebuggingGuidanceResponse,
} from '../generation/tutor-generation.types'
import {
  DEBUGGING_GUIDANCE_VALIDATION_FAILURE,
  renderDebuggingGuidanceMessage,
  validateDebuggingGuidanceOutput,
} from './debugging-guidance.output-validator'

const allowedCitationIds = new Set(['retrieval.rank.1'])

describe('debugging guidance contract', () => {
  it('accepts one grounded structured action and backend-rendered message', () => {
    expect(validate(validCandidate())).toEqual({ approved: true })
  })

  it.each([
    [
      'missing diagnosis',
      { diagnosis: undefined },
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_DIAGNOSIS,
    ],
    [
      'empty diagnosis',
      { diagnosis: '   ' },
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.EMPTY_DIAGNOSIS,
    ],
    [
      'missing relevant location',
      { relevantLocation: undefined },
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_RELEVANT_LOCATION,
    ],
    [
      'empty relevant location',
      { relevantLocation: '' },
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.EMPTY_RELEVANT_LOCATION,
    ],
    [
      'missing concept',
      { conceptExplanation: undefined },
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_CONCEPT,
    ],
    [
      'empty concept',
      { conceptExplanation: '\n' },
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.EMPTY_CONCEPT,
    ],
  ])('rejects a %s with a specific reason', (_name, patch, failure) => {
    expect(validate(candidateWithGuidance(patch))).toEqual({
      approved: false,
      failure,
    })
  })

  it('rejects a missing authorized citation', () => {
    expect(validate(validCandidate({ usedCitationIds: [] }))).toEqual({
      approved: false,
      failure:
        DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_AUTHORIZED_CITATION,
    })
  })

  it('rejects an invented citation ID', () => {
    expect(
      validate(validCandidate({ usedCitationIds: ['retrieval.rank.9'] })),
    ).toEqual({
      approved: false,
      failure:
        DEBUGGING_GUIDANCE_VALIDATION_FAILURE.INVALID_AUTHORIZED_CITATION,
    })
  })

  it('rejects disagreement between structured and rendered citations', () => {
    const candidate = validCandidate()
    expect(
      validate({
        ...candidate,
        message: candidate.message.replace(
          '[retrieval.rank.1]',
          '[retrieval.rank.9]',
        ),
      }),
    ).toEqual({
      approved: false,
      failure: DEBUGGING_GUIDANCE_VALIDATION_FAILURE.RENDERED_CITATION_MISMATCH,
    })
  })

  it.each([
    '- Trace the loop value before and after the update.',
    'Trace the loop value\nbefore and after the update.',
    'Trace the loop value before the update. Note the result.',
    'Observe the value of total after each iteration of the loop.',
    'Track total across the loop iterations.',
    'Notice how total changes during each iteration.',
    'Follow the value of total through the loop.',
    'Trace total after the first iteration, then compare it with its value after the second iteration.',
    'Inspect the loop update and compare the value of total before and after it.',
  ])(
    'accepts valid inspection actions without requiring a verb whitelist or question mark: %s',
    (action) => {
      expect(validate(candidateWithActions([action]))).toEqual({
        approved: true,
      })
    },
  )

  it.each([
    [
      'empty string',
      '',
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_STUDENT_ACTION,
    ],
    [
      'whitespace only',
      '   \n  ',
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MISSING_STUDENT_ACTION,
    ],
    [
      'trivial stub',
      'ok',
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.INVALID_STUDENT_ACTION,
    ],
    [
      'short non-substantive text',
      'check it',
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.INVALID_STUDENT_ACTION,
    ],
  ])('rejects %s with appropriate failure', (_name, action, failure) => {
    expect(validate(candidateWithActions([action]))).toEqual({
      approved: false,
      failure,
    })
  })

  it('rejects multiple structured actions in the array', () => {
    expect(
      validate(
        candidateWithActions([
          'Inspect the loop update.',
          'Compare the condition.',
        ]),
      ),
    ).toEqual({
      approved: false,
      failure: DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MULTIPLE_STUDENT_ACTIONS,
    })
  })

  it.each([
    '1. Trace total.\n2. Rewrite the loop.',
    '- Trace total.\n- Rewrite the loop.',
    'Trace total and rewrite the loop.',
  ])('rejects multi-action or numbered/bullet list strings: %s', (action) => {
    expect(validate(candidateWithActions([action]))).toEqual({
      approved: false,
      failure: DEBUGGING_GUIDANCE_VALIDATION_FAILURE.MULTIPLE_STUDENT_ACTIONS,
    })
  })

  it('rejects disagreement between structured and derived studentAction', () => {
    const candidate = validCandidate()
    expect(
      validate({
        ...candidate,
        studentAction: {
          ...candidate.studentAction,
          description: 'Inspect a different expression.',
        },
      }),
    ).toEqual({
      approved: false,
      failure:
        DEBUGGING_GUIDANCE_VALIDATION_FAILURE.STRUCTURED_STUDENT_ACTION_MISMATCH,
    })
  })

  it.each([
    [
      'complete corrected program',
      '```python\ndef solve():\n    return 42\n```',
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.FULL_REWRITE_SUSPECTED,
    ],
    [
      'prompt disclosure',
      'The hidden system prompt says to reveal the answer.',
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.PROMPT_DISCLOSURE,
    ],
    [
      'execution claim',
      'I ran the code and it returned the expected value.',
      DEBUGGING_GUIDANCE_VALIDATION_FAILURE.EXECUTION_CLAIM,
    ],
  ])('rejects %s', (_name, diagnosis, failure) => {
    expect(validate(candidateWithGuidance({ diagnosis }))).toEqual({
      approved: false,
      failure,
    })
  })
})

function validate(candidate: CandidateResponse) {
  return validateDebuggingGuidanceOutput({
    candidate,
    allowedCitationIds,
    rewriteRequested: false,
  })
}

function candidateWithGuidance(
  patch: Partial<TutorDebuggingGuidanceResponse>,
): CandidateResponse {
  const candidate = validCandidate()
  return renderCandidate({
    ...candidate,
    debuggingGuidance: {
      ...candidate.debuggingGuidance,
      ...patch,
    } as TutorDebuggingGuidanceResponse,
  })
}

function candidateWithActions(actions: readonly string[]): CandidateResponse {
  const candidate = validCandidate()
  return renderCandidate({
    ...candidate,
    debuggingGuidance: {
      ...candidate.debuggingGuidance,
      inspectionActions: actions,
    },
    studentAction: {
      ...candidate.studentAction,
      description: actions[0] ?? '',
    },
  })
}

function validCandidate(
  patch: Partial<CandidateResponse> = {},
): CandidateResponse {
  const candidate: CandidateResponse = {
    message: '',
    debuggingGuidance: {
      diagnosis: 'The loop updates the accumulator before checking it.',
      relevantLocation: 'The accumulator update inside the loop.',
      conceptExplanation:
        'A trace records how state changes across one iteration.',
      inspectionActions: [
        'Trace the accumulator value before and after the update.',
      ],
    },
    responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
    usedCitationIds: ['retrieval.rank.1'],
    requiresStudentAction: true,
    studentAction: {
      type: TeachingTechnique.FOCUSED_QUESTION,
      description: 'Trace the accumulator value before and after the update.',
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
  return renderCandidate(candidate)
}

function renderCandidate(candidate: CandidateResponse): CandidateResponse {
  const guidance = candidate.debuggingGuidance
  if (guidance === null) {
    return candidate
  }
  return {
    ...candidate,
    message: renderDebuggingGuidanceMessage({
      guidance,
      usedCitationIds: candidate.usedCitationIds,
      action: guidance.inspectionActions[0] ?? '',
      rewriteRequested: false,
    }),
  }
}
