import { MessageGuidanceLabel, MessageRequestKind } from '../../tutoring-values'
import { parseTutorDecision } from './tutor-decision.contract'

const validCodeDiagnosisDecision = () => ({
  requestKind: MessageRequestKind.CODE_DIAGNOSIS,
  strategy: 'DEBUGGING_GUIDANCE',
  hintLevel: null,
  promptVersion: 'debugging-guidance-prompt-v1',
  policyVersion: 'debugging-guidance-policy-v1',
  evidenceRequirement: 'COURSE_EVIDENCE_REQUIRED',
  forbiddenOutputs: ['FULL_CORRECTED_CODE', 'INVENTED_CITATION'],
  guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
})

describe('Tutor decision contract', () => {
  it('accepts CODE_DIAGNOSIS through the shared decision shape', () => {
    expect(parseTutorDecision(validCodeDiagnosisDecision())).toEqual(
      validCodeDiagnosisDecision(),
    )
  })

  it.each([
    [
      'a missing request kind',
      { ...validCodeDiagnosisDecision(), requestKind: undefined },
    ],
    [
      'an extra orchestration field',
      { ...validCodeDiagnosisDecision(), endpoint: '/code-diagnosis' },
    ],
    [
      'an invalid request-kind enum',
      { ...validCodeDiagnosisDecision(), requestKind: 'PYTHON' },
    ],
    [
      'a code-specific hint level',
      { ...validCodeDiagnosisDecision(), hintLevel: 1 },
    ],
    [
      'a parallel strategy',
      { ...validCodeDiagnosisDecision(), strategy: 'SECOND_CLASSIFIER' },
    ],
    [
      'a missing full-code prohibition',
      {
        ...validCodeDiagnosisDecision(),
        forbiddenOutputs: ['INVENTED_CITATION'],
      },
    ],
    [
      'duplicate forbidden outputs',
      {
        ...validCodeDiagnosisDecision(),
        forbiddenOutputs: ['FULL_CORRECTED_CODE', 'FULL_CORRECTED_CODE'],
      },
    ],
  ])('rejects %s', (_, value) => {
    expect(() => parseTutorDecision(value)).toThrow()
  })
})
