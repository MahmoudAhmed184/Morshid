import { MessageRequestKind, StudentState } from '../tutoring-values'

import { EFFORT_QUALITY } from './educational-analysis.types'
import { buildTutorResponseRequirements } from './tutor-response-requirements'

describe('Tutor response requirements', () => {
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
    },
    guidanceLevel,
  })
}
