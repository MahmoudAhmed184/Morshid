import { MessageRequestKind, StudentState } from '../../tutoring-values'

import {
  EDUCATIONAL_ANALYSIS_SOURCE,
  EFFORT_QUALITY,
  LEARNING_EVIDENCE_STRENGTH,
  type EffortEvidence,
  type LearningEvidence,
} from '../analysis/educational-analysis.types'
import { buildTutorResponseRequirements } from './tutor-response-requirements'

describe('Tutor response requirements', () => {
  it('keeps the conceptual explanation requirement separate from the student action', () => {
    const requirements = buildTutorResponseRequirements({
      analysis: {
        requestKind: MessageRequestKind.CONCEPTUAL,
        studentState: StudentState.NO_PRIOR_KNOWLEDGE,
        effortEvidence: noEffort(),
        learningEvidence: noLearning(),
        misconceptions: [],
      },
      analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
      studentMessageId: 'message-1',
      guidanceLevel: 1,
      protectTargetSolution: false,
    })

    expect(requirements).toMatchObject({
      minimumUsefulConceptualExplanationRequired: true,
      protectExactOriginalSolution: false,
      guidanceShape: {
        mode: 'ORIENTATION',
      },
    })
    expect(requirements).not.toHaveProperty(
      'conceptualUnderstandingCheckRequired',
    )
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
        learningEvidence: noLearning(),
        misconceptions: [
          {
            code: 'BREAK_CONTINUE_REVERSAL',
            description: 'The student reverses break and continue behavior.',
            confidence: 0.95,
            evidenceMessageId: 'message-1',
          },
        ],
      },
      analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
      studentMessageId: 'message-1',
      guidanceLevel: 1,
      protectTargetSolution: false,
    })

    expect(requirements.minimumUsefulConceptualExplanationRequired).toBe(false)
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

    expect(requirements.acknowledgeStudentSupportedCorrectWork).toBe(true)
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

  it('requires brief acknowledgment for strong current-message-supported correct work', () => {
    const requirements = buildTutorResponseRequirements({
      analysis: {
        requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
        studentState: StudentState.NEAR_SOLUTION,
        effortEvidence: noEffort(),
        learningEvidence: {
          present: true,
          strength: LEARNING_EVIDENCE_STRENGTH.STRONG,
          evidenceMessageIds: ['message-1'],
        },
        misconceptions: [],
      },
      analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
      studentMessageId: 'message-1',
      guidanceLevel: 1,
      protectTargetSolution: true,
    })

    expect(requirements).toMatchObject({
      acknowledgeStudentSupportedCorrectWork: true,
      guidanceShape: { mode: 'ORIENTATION' },
    })
  })

  it('does not require acknowledgment for an unsupported self-report', () => {
    const requirements = buildTutorResponseRequirements({
      analysis: {
        requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
        studentState: StudentState.NEAR_SOLUTION,
        effortEvidence: noEffort(),
        learningEvidence: noLearning(),
        misconceptions: [],
      },
      analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
      studentMessageId: 'message-1',
      guidanceLevel: 1,
      protectTargetSolution: true,
    })

    expect(requirements.acknowledgeStudentSupportedCorrectWork).toBe(false)
  })

  it.each([
    MessageRequestKind.CONCEPTUAL,
    MessageRequestKind.ATTEMPT_DIAGNOSIS,
  ])('does not infer protected output from request kind %s', (requestKind) => {
    const requirements = buildTutorResponseRequirements({
      analysis: {
        requestKind,
        studentState: StudentState.MISCONCEPTION,
        effortEvidence: noEffort(),
        learningEvidence: noLearning(),
        misconceptions: [],
      },
      analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
      studentMessageId: 'message-1',
      guidanceLevel: 2,
      protectTargetSolution: false,
    })

    expect(requirements.protectExactOriginalSolution).toBe(false)
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
      learningEvidence: noLearning(),
      misconceptions: [],
    },
    analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
    studentMessageId: 'message-1',
    guidanceLevel,
    protectTargetSolution: true,
  })
}

function noLearning(): LearningEvidence {
  return {
    present: false,
    strength: LEARNING_EVIDENCE_STRENGTH.NONE,
    evidenceMessageIds: [],
  }
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
