import {
  ReflectionMode,
  StudentActionPurpose,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
import {
  RESPONSE_VALIDATION_STAGE,
  RESPONSE_VIOLATION_TYPE,
} from './response-validation.types'
import { StructuralResponseValidator } from './structural-response.validator'
import type { CandidateResponsePolicyContext } from '../generation/tutor-generation.types'

describe('StructuralResponseValidator', () => {
  it('approves a valid raw candidate', () => {
    const result = validator().validateRaw(validRawCandidate(), policy(), {
      provider: 'deterministic',
      model: 'deterministic-tutor',
      tokenUsage: { input: 0, output: 0 },
    })

    expect(result).toMatchObject({
      stage: RESPONSE_VALIDATION_STAGE.STRUCTURAL,
      approved: true,
    })
  })

  it('approves a no-action completion and preserves a null studentAction', () => {
    const result = validator().validateRaw(
      {
        ...validRawCandidate(),
        message: 'Your reasoning correctly completes this objective.',
        requiresStudentAction: false,
        studentAction: null,
      },
      {
        ...policy(),
        studentActionObligation: {
          ...policy().studentActionObligation,
          required: false,
          purpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
          technique: TeachingTechnique.VERIFICATION,
        },
      },
      {
        provider: 'deterministic',
        model: 'deterministic-tutor',
        tokenUsage: { input: 0, output: 0 },
      },
    )

    expect(result).toMatchObject({
      stage: RESPONSE_VALIDATION_STAGE.STRUCTURAL,
      approved: true,
    })
  })

  it('reports the contract stage and field for malformed studentAction output', () => {
    const result = validator().validateRaw(
      { ...validRawCandidate(), studentAction: null },
      policy(),
      {
        provider: 'deterministic',
        model: 'deterministic-tutor',
        tokenUsage: { input: 0, output: 0 },
      },
    )

    expect(result).toMatchObject({
      approved: false,
      violations: [
        {
          type: RESPONSE_VIOLATION_TYPE.MISSING_REQUIRED_FIELD,
          field: 'studentAction',
        },
      ],
    })
    expect(result.violations[0]?.evidence).toContain(
      'Contract stage CANDIDATE_SCHEMA',
    )
  })

  it.each([
    ['malformed', 'not-json', RESPONSE_VIOLATION_TYPE.MALFORMED_RESPONSE],
    [
      'missing required field',
      { ...validRawCandidate(), message: undefined },
      RESPONSE_VIOLATION_TYPE.MISSING_REQUIRED_FIELD,
    ],
    [
      'invalid enum',
      { ...validRawCandidate(), responseIntent: 'DIRECT_ANSWER' },
      RESPONSE_VIOLATION_TYPE.MISSING_REQUIRED_FIELD,
    ],
    [
      'oversized field',
      { ...validRawCandidate(), message: 'x'.repeat(2_401) },
      RESPONSE_VIOLATION_TYPE.MISSING_REQUIRED_FIELD,
    ],
    [
      'duplicate citation',
      {
        ...validRawCandidate(),
        usedCitationIds: ['retrieval.rank.1', 'retrieval.rank.1'],
      },
      RESPONSE_VIOLATION_TYPE.MISSING_REQUIRED_FIELD,
    ],
    [
      'unknown citation',
      { ...validRawCandidate(), usedCitationIds: ['retrieval.rank.2'] },
      RESPONSE_VIOLATION_TYPE.INVALID_CITATION,
    ],
    [
      'invalid action requirement',
      { ...validRawCandidate(), requiresStudentAction: false },
      RESPONSE_VIOLATION_TYPE.MISSING_REQUIRED_FIELD,
    ],
    [
      'spoofed metadata',
      { ...validRawCandidate(), provider: 'model-provider' },
      RESPONSE_VIOLATION_TYPE.MISSING_REQUIRED_FIELD,
    ],
    [
      'approval-like field',
      { ...validRawCandidate(), approved: true },
      RESPONSE_VIOLATION_TYPE.MISSING_REQUIRED_FIELD,
    ],
  ])('rejects %s without leaking raw parser errors', (_name, raw, type) => {
    const result = validator().validateRaw(raw, policy(), {
      provider: 'deterministic',
      model: 'deterministic-tutor',
      tokenUsage: { input: 0, output: 0 },
    })

    expect(result.approved).toBe(false)
    expect(result.violations[0]?.type).toBe(type)
    expect(result.violations[0]?.evidence).not.toContain('ZodError')
  })
})

function validator() {
  return new StructuralResponseValidator()
}

function validRawCandidate() {
  return {
    message: 'What changes first in the loop? [retrieval.rank.1]',
    debuggingGuidance: null,
    responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
    usedCitationIds: ['retrieval.rank.1'],
    requiresStudentAction: true,
    studentAction: {
      type: TeachingTechnique.ORIENTATION_QUESTION,
      description: 'Ask for the first value that changes.',
    },
    reflectionIncluded: false,
    selfReportedCompliance: {
      finalAnswerRevealed: false,
      completeSolutionRevealed: false,
    },
  }
}

function policy(): CandidateResponsePolicyContext {
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
  }
}
