import { RevealPolicy } from '../../../generated/prisma/client'

import { buildSocraticDisclosureContract } from './socratic-disclosure-policy'
import type { TeachingGuardPolicy } from './teaching-policy.types'

describe('Socratic disclosure policy', () => {
  it.each([1, 2])(
    'preserves the target inference at low Guidance Level %s',
    (guidanceLevel) => {
      expect(
        contract({
          guidanceLevel,
          revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
        }),
      ).toMatchObject({
        directTargetInferenceAllowed: false,
        intermediateResultAllowed: false,
        finalReasoningAllowed: false,
        finalAnswerAllowed: false,
        completeSolutionAllowed: false,
        retrievedEvidenceIsDisclosurePermission: false,
      })
    },
  )

  it('keeps a small-hint turn bounded to a clue or focused question', () => {
    const result = contract({
      guidanceLevel: 1,
      revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    })

    expect(result.guidanceMode).toBe('ORIENTATION')
    expect(result.requiredStudentWork).toContain(
      'do not state the target inference first',
    )
  })

  it.each([
    [RevealPolicy.NO_FINAL_ANSWER, false, false, false],
    [RevealPolicy.PARTIAL_RESULT_ALLOWED, true, false, false],
    [RevealPolicy.FINAL_REASONING_ALLOWED, true, true, false],
    [RevealPolicy.COMPLETE_SOLUTION_ALLOWED, true, true, true],
  ])(
    'enforces Reveal Policy %s independently',
    (
      revealPolicy,
      intermediateResultAllowed,
      finalReasoningAllowed,
      completeSolutionAllowed,
    ) => {
      const result = contract({
        guidanceLevel: 4,
        revealPolicy,
        guardPolicy: permissiveGuardPolicy(),
      })

      expect(result).toMatchObject({
        intermediateResultAllowed,
        finalReasoningAllowed,
        completeSolutionAllowed,
      })
    },
  )

  it('progresses support without letting Guidance Level override Reveal Policy', () => {
    const focusedHint = contract({
      guidanceLevel: 2,
      revealPolicy: RevealPolicy.PARTIAL_RESULT_ALLOWED,
    })
    const decomposition = contract({
      guidanceLevel: 3,
      revealPolicy: RevealPolicy.PARTIAL_RESULT_ALLOWED,
    })
    const strongNoAnswer = contract({
      guidanceLevel: 4,
      revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
      guardPolicy: permissiveGuardPolicy(),
    })

    expect(focusedHint.intermediateResultAllowed).toBe(false)
    expect(decomposition.intermediateResultAllowed).toBe(true)
    expect(decomposition.directTargetInferenceAllowed).toBe(false)
    expect(strongNoAnswer.finalAnswerAllowed).toBe(false)
    expect(strongNoAnswer.completeSolutionAllowed).toBe(false)
  })

  it('allows direct explanation only when the trusted controls permit it', () => {
    const result = contract({
      guidanceLevel: 4,
      revealPolicy: RevealPolicy.COMPLETE_SOLUTION_ALLOWED,
      guardPolicy: permissiveGuardPolicy(),
    })

    expect(result.directTargetInferenceAllowed).toBe(true)
    expect(result.finalReasoningAllowed).toBe(true)
    expect(result.finalAnswerAllowed).toBe(true)
    expect(result.completeSolutionAllowed).toBe(true)
  })
})

function contract(input: {
  guidanceLevel: number
  revealPolicy: RevealPolicy
  guardPolicy?: TeachingGuardPolicy
}) {
  return buildSocraticDisclosureContract({
    guidanceLevel: input.guidanceLevel,
    revealPolicy: input.revealPolicy,
    guardPolicy: input.guardPolicy ?? restrictiveGuardPolicy(),
  })
}

function restrictiveGuardPolicy(): TeachingGuardPolicy {
  return {
    preventDirectAnswer: true,
    preventFinalResult: true,
    preventCompleteSolution: true,
    preventSubmissionReadyCode: true,
    preventProtectedCodeLeakage: true,
    requireStudentReasoning: true,
    requireGrounding: true,
    enforceCitationSupport: true,
    maximumDisclosedSteps: 1,
  }
}

function permissiveGuardPolicy(): TeachingGuardPolicy {
  return {
    ...restrictiveGuardPolicy(),
    preventDirectAnswer: false,
    preventFinalResult: false,
    preventCompleteSolution: false,
    preventSubmissionReadyCode: false,
    preventProtectedCodeLeakage: false,
  }
}
