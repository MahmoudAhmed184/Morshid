import { MessageRequestKind, StudentState } from '../../tutoring-values'
import type { AnalysisContextPackage } from './analysis-context.types'
import { reconcileEducationalAnalysisRequestKind } from './educational-analysis.reconciler'
import type { EducationalAnalysisResult } from './educational-analysis.types'

describe('educational analysis request-kind reconciliation', () => {
  it('classifies current-message-supported reasoning as attempt diagnosis', () => {
    expect(
      reconcileEducationalAnalysisRequestKind(
        analysis({ requestKind: MessageRequestKind.CONCEPTUAL }),
        context(),
      ).requestKind,
    ).toBe(MessageRequestKind.ATTEMPT_DIAGNOSIS)
  })

  it('classifies current-message-supported debugging effort as code diagnosis', () => {
    expect(
      reconcileEducationalAnalysisRequestKind(
        analysis({
          requestKind: MessageRequestKind.AMBIGUOUS,
          studentState: StudentState.DEBUGGING_ISSUE,
        }),
        context(),
      ).requestKind,
    ).toBe(MessageRequestKind.CODE_DIAGNOSIS)
  })

  it.each([
    ['a new problem without effort', analysis({ effortPresent: false })],
    [
      'effort supported only by an older message',
      analysis({ effortEvidenceMessageIds: ['older-message'] }),
    ],
    [
      'an authoritative unsafe classification',
      analysis({ requestKind: MessageRequestKind.UNSAFE }),
    ],
  ])('does not rewrite %s', (_label, result) => {
    expect(reconcileEducationalAnalysisRequestKind(result, context())).toBe(
      result,
    )
  })
})

function analysis(
  input: Partial<{
    requestKind: MessageRequestKind
    studentState: StudentState
    effortPresent: boolean
    effortEvidenceMessageIds: string[]
  }> = {},
): EducationalAnalysisResult {
  const effortPresent = input.effortPresent ?? true

  return {
    requestKind: input.requestKind ?? MessageRequestKind.PROBLEM_LIKE,
    studentState: input.studentState ?? StudentState.MISCONCEPTION,
    effortEvidence: {
      present: effortPresent,
      quality: effortPresent ? 'MEANINGFUL' : 'NONE',
      type: effortPresent ? 'REASONING_ATTEMPT' : null,
      addressesPreviousTutorAction: effortPresent,
      isRepeated: false,
      evidenceMessageIds:
        input.effortEvidenceMessageIds ??
        (effortPresent ? ['current-message'] : []),
    },
    learningEvidence: {
      present: false,
      strength: 'NONE',
      evidenceMessageIds: [],
    },
    misconceptions: [],
    topicRelation: 'CONTINUE_CURRENT_TOPIC',
    recommendedStrategy: 'MISCONCEPTION_REPAIR',
    recommendedTechnique: 'COUNTEREXAMPLE',
    recommendedGuidanceLevel: 2,
    confidence: 0.95,
    evidenceReferences: ['current-message'],
  }
}

function context(): AnalysisContextPackage {
  return {
    studentMessage: { id: 'current-message' },
  } as AnalysisContextPackage
}
