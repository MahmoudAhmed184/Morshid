import { MessageRequestKind, StudentState } from '../../tutoring-values'

import {
  EFFORT_QUALITY,
  type EffortEvidence,
} from '../analysis/educational-analysis.types'
import { buildTutorResponseRequirements } from './tutor-response-requirements'

describe('Tutor response requirements', () => {
  it('requires a minimum explanation and understanding check for a beginner conceptual request', () => {
    const requirements = buildTutorResponseRequirements({
      analysis: {
        requestKind: MessageRequestKind.CONCEPTUAL,
        studentState: StudentState.NO_PRIOR_KNOWLEDGE,
        effortEvidence: noEffort(),
        misconceptions: [],
      },
      guidanceLevel: 1,
    })

    expect(requirements).toMatchObject({
      minimumUsefulConceptualExplanationRequired: true,
      conceptualUnderstandingCheckRequired: true,
      protectExactOriginalSolution: false,
      guidanceShape: {
        mode: 'ORIENTATION',
      },
    })
    expect(requirements.guidanceShape.residualStudentWork).toContain('applies')
    expect(requirements.guidanceShape.generationInstruction).toContain(
      'State the minimum useful grounded core concept',
    )
  })

  it('does not apply the direct conceptual requirement to a misconception', () => {
    const requirements = buildTutorResponseRequirements({
      analysis: {
        requestKind: MessageRequestKind.CONCEPTUAL,
        studentState: StudentState.MISCONCEPTION,
        effortEvidence: noEffort(),
        misconceptions: [
          {
            code: 'BREAK_CONTINUE_REVERSAL',
            description: 'The student reverses break and continue behavior.',
            confidence: 0.95,
            evidenceMessageId: 'message-1',
          },
        ],
      },
      guidanceLevel: 1,
    })

    expect(requirements).toMatchObject({
      minimumUsefulConceptualExplanationRequired: false,
      conceptualUnderstandingCheckRequired: false,
    })
  })

  it('makes Level 2 a single focused hint rather than a decomposition', () => {
    const requirements = requirementsAt(2)

    expect(requirements.guidanceShape).toMatchObject({
      mode: 'FOCUSED_HINT',
      minimumConnectedScaffoldMoves: 1,
      orderedDecompositionRequired: false,
      singleGuidingQuestionIsSufficient: true,
      analogousExampleOrNearCompleteScaffoldRequired: false,
    })
  })

  it('requires Level 3 to preserve established work and visibly decompose the reasoning', () => {
    const requirements = requirementsAt(3)

    expect(requirements.guidanceShape).toMatchObject({
      mode: 'GUIDED_DECOMPOSITION',
      minimumConnectedScaffoldMoves: 2,
      orderedDecompositionRequired: true,
      preserveEstablishedIntermediateConclusions: true,
      explainConnectionsBetweenScaffoldMoves: true,
      singleGuidingQuestionIsSufficient: false,
      analogousExampleOrNearCompleteScaffoldRequired: false,
    })
    expect(requirements.guidanceShape.generationInstruction).toContain(
      'A confirmation plus one guiding question',
    )
  })

  it('requires Level 4 to exceed Level 3 with bounded strong guidance', () => {
    const level3 = requirementsAt(3)
    const level4 = requirementsAt(4)

    expect(level4.guidanceShape).toMatchObject({
      mode: 'STRONG_GUIDANCE',
      minimumConnectedScaffoldMoves: 3,
      orderedDecompositionRequired: true,
      preserveEstablishedIntermediateConclusions: true,
      explainConnectionsBetweenScaffoldMoves: true,
      singleGuidingQuestionIsSufficient: false,
      analogousExampleOrNearCompleteScaffoldRequired: true,
    })
    expect(level4.guidanceShape.minimumConnectedScaffoldMoves).toBeGreaterThan(
      level3.guidanceShape.minimumConnectedScaffoldMoves,
    )
    expect(level4.guidanceShape.generationInstruction).toContain(
      'visibly more support than Guided Decomposition',
    )
  })
})

function requirementsAt(guidanceLevel: number) {
  return buildTutorResponseRequirements({
    analysis: {
      requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
      studentState: StudentState.PARTIAL_UNDERSTANDING,
      effortEvidence: {
        present: true,
        quality: EFFORT_QUALITY.MEANINGFUL,
        type: 'REASONING_ATTEMPT',
        addressesPreviousTutorAction: true,
        isRepeated: false,
        evidenceMessageIds: ['message-1'],
      },
      misconceptions: [],
    },
    guidanceLevel,
  })
}

function noEffort(): EffortEvidence {
  return {
    present: false,
    quality: EFFORT_QUALITY.NONE,
    type: null,
    addressesPreviousTutorAction: false,
    isRepeated: false,
    evidenceMessageIds: [],
  }
}
