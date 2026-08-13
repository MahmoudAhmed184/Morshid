import { MessageGuidanceLabel, MessageRequestKind } from '../../tutoring-values'
import {
  DEBUGGING_GUIDANCE_RESPONSE_GOVERNANCE_RESULTS,
  DEBUGGING_GUIDANCE_TUTOR_DECISION,
  DEBUGGING_GUIDANCE_UNTRUSTED_FIELDS,
  parseDebuggingGuidance,
} from './debugging-guidance.contract'

const validDiagnosis = () => ({
  likelyDefect: 'The referenced name does not match the function parameter.',
  location: 'The return expression in the function body.',
  conceptExplanation: 'Name lookup resolves names in the active scope.',
  nextInspectionStep:
    'Compare the name in the return expression with the parameter name.',
  citations: [
    {
      materialId: '11111111-1111-4111-8111-111111111111',
      chunkId: '22222222-2222-4222-8222-222222222222',
    },
  ],
})

describe('Debugging guidance contract', () => {
  it('uses the shared Tutor decision and existing persistence enums', () => {
    expect(DEBUGGING_GUIDANCE_TUTOR_DECISION).toEqual({
      requestKind: MessageRequestKind.CODE_DIAGNOSIS,
      strategy: 'DEBUGGING_GUIDANCE',
      hintLevel: null,
      promptVersion: 'debugging-guidance-prompt-v1',
      policyVersion: 'debugging-guidance-policy-v1',
      evidenceRequirement: 'COURSE_EVIDENCE_REQUIRED',
      forbiddenOutputs: [
        'FULL_CORRECTED_CODE',
        'PROMPT_DISCLOSURE',
        'EXECUTION_CLAIM',
        'INVENTED_CITATION',
      ],
      guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
    })
    expect(Object.isFrozen(DEBUGGING_GUIDANCE_TUTOR_DECISION)).toBe(true)
    expect(
      Object.isFrozen(DEBUGGING_GUIDANCE_TUTOR_DECISION.forbiddenOutputs),
    ).toBe(true)
  })

  it('accepts only the diagnosis semantic fields and citation references', () => {
    expect(parseDebuggingGuidance(validDiagnosis())).toEqual(validDiagnosis())
  })

  it.each([
    ['missing location', { ...validDiagnosis(), location: undefined }],
    [
      'a corrected-program field',
      { ...validDiagnosis(), correctedProgram: 'def corrected(): pass' },
    ],
    [
      'an execution-output field',
      { ...validDiagnosis(), executionOutput: 'program finished' },
    ],
    [
      'an invalid citation',
      {
        ...validDiagnosis(),
        citations: [{ materialId: 'not-a-uuid', chunkId: 'also-invalid' }],
      },
    ],
  ])('rejects %s', (_, value) => {
    expect(() => parseDebuggingGuidance(value)).toThrow()
  })

  it('locks the later output-guard policy result vocabulary', () => {
    expect(DEBUGGING_GUIDANCE_RESPONSE_GOVERNANCE_RESULTS).toEqual([
      'ALLOWED_DIAGNOSIS',
      'INVALID_RESPONSE_SHAPE',
      'FULL_REWRITE_SUSPECTED',
      'CODE_BLOCK_TOO_LARGE',
      'PROMPT_DISCLOSURE',
      'EXECUTION_CLAIM',
      'INVALID_CITATION',
      'UNSUPPORTED_SCOPE',
    ])
  })

  it('marks every dynamic strategy field as untrusted data', () => {
    expect(DEBUGGING_GUIDANCE_UNTRUSTED_FIELDS).toEqual([
      'STUDENT_MESSAGE',
      'STUDENT_CODE',
      'CODE_COMMENTS',
      'CODE_STRINGS',
      'IDENTIFIERS',
      'ERROR_TEXT',
      'RETRIEVED_COURSE_CONTENT',
    ])
  })
})
