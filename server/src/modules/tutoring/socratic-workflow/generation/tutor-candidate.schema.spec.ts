import {
  ReflectionMode,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
import {
  TUTOR_CANDIDATE_LIMITS,
  type CandidateResponsePolicyContext,
} from './tutor-generation.types'
import { TUTOR_GENERATION_PROMPT_VERSION } from './tutor-prompt.definition'
import { validateCandidateResponse } from './tutor-candidate.schema'

describe('candidate response validation', () => {
  it('accepts a valid content-only candidate and attaches backend metadata', () => {
    const result = validateCandidateResponse(validCandidate(), policy(), {
      provider: 'deterministic',
      model: 'deterministic-tutor',
      tokenUsage: { input: 12, output: 7 },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject({
        provider: 'deterministic',
        model: 'deterministic-tutor',
        promptVersion: TUTOR_GENERATION_PROMPT_VERSION,
        tokenUsage: { input: 12, output: 7 },
        usedCitationIds: ['retrieval.rank.1'],
      })
    }
  })

  it('rejects duplicate citation IDs', () => {
    const result = validateCandidateResponse(
      validCandidate({
        usedCitationIds: ['retrieval.rank.1', 'retrieval.rank.1'],
      }),
      policy(),
      metadata(),
    )

    expect(result).toEqual({
      success: false,
      errorCode: 'TUTOR_INVALID_OUTPUT',
    })
  })

  it.each([
    [
      'missing message',
      withoutKey(validCandidate(), 'message'),
      'TUTOR_MALFORMED_OUTPUT',
    ],
    ['empty message', validCandidate({ message: '' }), 'TUTOR_INVALID_OUTPUT'],
    [
      'oversized message',
      validCandidate({
        message: 'x'.repeat(TUTOR_CANDIDATE_LIMITS.maxMessageCodePoints + 1),
      }),
      'TUTOR_INVALID_OUTPUT',
    ],
    [
      'unsupported intent',
      validCandidate({ responseIntent: 'DIRECT_ANSWER' }),
      'TUTOR_INVALID_OUTPUT',
    ],
    [
      'invalid action',
      validCandidate({
        studentAction: { type: 'LECTURE', description: 'Try.' },
      }),
      'TUTOR_INVALID_OUTPUT',
    ],
    [
      'oversized action',
      validCandidate({
        studentAction: {
          type: TeachingTechnique.ORIENTATION_QUESTION,
          description: 'x'.repeat(
            TUTOR_CANDIDATE_LIMITS.maxStudentActionDescriptionCodePoints + 1,
          ),
        },
      }),
      'TUTOR_INVALID_OUTPUT',
    ],
    [
      'invalid reflection',
      validCandidate({ reflectionIncluded: true }),
      'TUTOR_INVALID_OUTPUT',
    ],
    [
      'invalid compliance',
      validCandidate({
        selfReportedCompliance: { finalAnswerRevealed: false },
      }),
      'TUTOR_INVALID_OUTPUT',
    ],
    [
      'prohibited final-answer admission',
      validCandidate({
        selfReportedCompliance: {
          finalAnswerRevealed: true,
          completeSolutionRevealed: false,
        },
      }),
      'TUTOR_INVALID_OUTPUT',
    ],
    [
      'too many citations',
      validCandidate({
        usedCitationIds: Array.from(
          { length: TUTOR_CANDIDATE_LIMITS.maxCitationIds + 1 },
          (_, index) => `retrieval.rank.${String(index + 1)}`,
        ),
      }),
      'TUTOR_INVALID_OUTPUT',
    ],
    [
      'model-owned provider metadata',
      { ...validCandidate(), provider: 'model-supplied' },
      'TUTOR_INVALID_OUTPUT',
    ],
    [
      'approval field',
      { ...validCandidate(), approved: true },
      'TUTOR_INVALID_OUTPUT',
    ],
  ])('rejects %s', (_name, candidate, errorCode) => {
    expect(validateCandidateResponse(candidate, policy(), metadata())).toEqual({
      success: false,
      errorCode,
    })
  })

  it('rejects unknown citation IDs', () => {
    expect(
      validateCandidateResponse(
        validCandidate({ usedCitationIds: ['invented'] }),
        policy(),
        metadata(),
      ),
    ).toEqual({
      success: false,
      errorCode: 'TUTOR_INVALID_CITATION',
    })
  })

  it('rejects an ungrounded candidate when evidence is available', () => {
    expect(
      validateCandidateResponse(
        validCandidate({ usedCitationIds: [] }),
        policy(),
        metadata(),
      ),
    ).toEqual({
      success: false,
      errorCode: 'TUTOR_INVALID_CITATION',
    })
  })

  it('allows a citation-free candidate when no evidence is available', () => {
    expect(
      validateCandidateResponse(
        validCandidate({ usedCitationIds: [] }),
        { ...policy(), allowedCitationIds: new Set() },
        metadata(),
      ).success,
    ).toBe(true)
  })

  it('accepts canonical debugging guidance and derives message and studentAction', () => {
    const result = validateCandidateResponse(
      validDebuggingCandidate(),
      debuggingPolicy(),
      metadata(),
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.debuggingGuidance).toMatchObject({
        diagnosis: 'The loop update likely uses the wrong variable.',
        relevantLocation: 'Inspect the assignment inside the loop body.',
        inspectionActions: ['Trace the accumulator through one iteration.'],
      })
      expect(result.data.message).toContain('[retrieval.rank.1]')
      expect(result.data.studentAction).toEqual({
        type: TeachingTechnique.FOCUSED_QUESTION,
        description: 'Trace the accumulator through one iteration.',
      })
    }
  })

  it('preserves incomplete structured debugging guidance for precise guard diagnostics', () => {
    const candidate = validDebuggingCandidate()
    const result = validateCandidateResponse(
      {
        ...candidate,
        debuggingGuidance: {
          relevantLocation: 'Inspect the assignment inside the loop body.',
          conceptExplanation:
            'An accumulator must be updated from its prior value.',
          inspectionActions: ['Trace the accumulator through one iteration.'],
        },
      },
      debuggingPolicy(),
      metadata(),
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.debuggingGuidance?.diagnosis).toBeUndefined()
    }
  })

  it('rejects the obsolete debuggingGuidanceSections pseudo-field', () => {
    expect(
      validateCandidateResponse(
        {
          ...validDebuggingCandidate(),
          debuggingGuidanceSections: {},
        },
        debuggingPolicy(),
        metadata(),
      ),
    ).toEqual({
      success: false,
      errorCode: 'TUTOR_INVALID_OUTPUT',
    })
  })

  it('rejects canonical debugging guidance outside a debugging turn', () => {
    expect(
      validateCandidateResponse(
        validDebuggingCandidate(),
        policy(),
        metadata(),
      ),
    ).toEqual({
      success: false,
      errorCode: 'TUTOR_INVALID_OUTPUT',
    })
  })
})

function validCandidate(patch: Record<string, unknown> = {}) {
  return {
    message: 'What value changes on each loop iteration? [retrieval.rank.1]',
    debuggingGuidance: null,
    responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
    usedCitationIds: ['retrieval.rank.1'],
    requiresStudentAction: true,
    studentAction: {
      type: TeachingTechnique.ORIENTATION_QUESTION,
      description: 'Ask the student to inspect the loop update.',
    },
    reflectionIncluded: false,
    selfReportedCompliance: {
      finalAnswerRevealed: false,
      completeSolutionRevealed: false,
    },
    ...patch,
  }
}

function policy(): CandidateResponsePolicyContext {
  return {
    allowedCitationIds: new Set(['retrieval.rank.1']),
    requireGrounding: true,
    enforceCitationSupport: true,
    requireStudentAction: true,
    reflectionMode: ReflectionMode.NONE,
  }
}

function validDebuggingCandidate() {
  return {
    message: null,
    debuggingGuidance: {
      diagnosis: 'The loop update likely uses the wrong variable.',
      relevantLocation: 'Inspect the assignment inside the loop body.',
      conceptExplanation:
        'An accumulator must be updated from its prior value.',
      inspectionActions: ['Trace the accumulator through one iteration.'],
    },
    responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
    usedCitationIds: ['retrieval.rank.1'],
    requiresStudentAction: true,
    studentAction: null,
    reflectionIncluded: false,
    selfReportedCompliance: {
      finalAnswerRevealed: false,
      completeSolutionRevealed: false,
    },
  }
}

function debuggingPolicy(): CandidateResponsePolicyContext {
  return {
    ...policy(),
    debuggingGuidanceRequired: true,
    debuggingRewriteRequested: false,
    studentActionType: TeachingTechnique.FOCUSED_QUESTION,
  }
}

function metadata() {
  return {
    provider: 'provider',
    model: 'model',
    tokenUsage: { input: 0, output: 0 },
  }
}

function withoutKey(value: Record<string, unknown>, key: string) {
  return Object.fromEntries(
    Object.entries(value).filter(([entryKey]) => entryKey !== key),
  )
}
