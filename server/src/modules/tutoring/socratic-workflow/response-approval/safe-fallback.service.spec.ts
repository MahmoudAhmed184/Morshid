import {
  ReflectionMode,
  RevealPolicy,
  StudentActionPurpose,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
import type { PersistedTeachingDecisionRecord } from '../teaching-decision/teaching-decision.repository'
import { SafeFallbackService } from './safe-fallback.service'

describe('SafeFallbackService', () => {
  it.each([
    {
      purpose: StudentActionPurpose.PRIOR_ATTEMPT_ORIENTATION,
      technique: TeachingTechnique.ORIENTATION_QUESTION,
      expectedDescription: 'describe what they tried',
    },
    {
      purpose: StudentActionPurpose.CONCEPTUAL_UNDERSTANDING,
      technique: TeachingTechnique.ORIENTATION_QUESTION,
      expectedDescription: 'conceptual understanding question',
    },
    {
      purpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
      technique: TeachingTechnique.FOCUSED_QUESTION,
      expectedDescription: 'FOCUSED_QUESTION reasoning question',
    },
  ])(
    'uses the resolved $purpose obligation',
    ({ purpose, technique, expectedDescription }) => {
      const response = new SafeFallbackService().create(
        decision({
          studentActionPurpose: purpose,
          primaryTechnique: technique,
        }),
      )

      expect(response.message).toBe(
        'Let us narrow it down to one step. Show the last step you were confident about and what you expected next.',
      )
      expect(response.studentAction.description).toContain(expectedDescription)
      expect(response).toMatchObject({
        requiresStudentAction: true,
        studentAction: {
          type: technique,
        },
        source: 'SAFE_FALLBACK',
      })
    },
  )
})

function decision(
  patch: Partial<PersistedTeachingDecisionRecord>,
): PersistedTeachingDecisionRecord {
  return {
    id: 'decision-1',
    attemptId: 'attempt-1',
    topicId: 'topic-1',
    analysisId: 'analysis-1',
    strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
    primaryTechnique: TeachingTechnique.FOCUSED_QUESTION,
    supportingTechnique: null,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    reflectionMode: ReflectionMode.NONE,
    requireStudentAction: true,
    studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
    guardPolicy: {
      preventDirectAnswer: true,
      preventFinalResult: true,
      preventCompleteSolution: true,
      preventSubmissionReadyCode: true,
      preventProtectedCodeLeakage: true,
      requireStudentReasoning: true,
      requireGrounding: true,
      enforceCitationSupport: true,
      maximumDisclosedSteps: 1,
    },
    decisionReason: 'test',
    policyVersion: 'socratic-policy.mvp.v5',
    createdAt: new Date('2026-08-15T00:00:00.000Z'),
    ...patch,
  }
}
