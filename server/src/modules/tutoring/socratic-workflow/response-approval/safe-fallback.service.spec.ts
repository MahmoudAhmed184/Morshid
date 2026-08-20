import {
  ExplanationDetailLevel,
  ReflectionMode,
  RevealPolicy,
  StudentActionPurpose,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
import { APPROVED_RESPONSE_SOURCE } from './response-validation.types'
import {
  SAFE_FALLBACK_PROMPT_VERSION,
  SafeFallbackService,
} from './safe-fallback.service'
import type { PersistedTeachingDecisionRecord } from '../teaching-decision/teaching-decision.repository'

describe('SafeFallbackService', () => {
  const service = new SafeFallbackService()

  function baseDecision(
    technique: TeachingTechnique,
    patch: Partial<PersistedTeachingDecisionRecord> = {},
  ): PersistedTeachingDecisionRecord {
    return {
      id: 'decision-1',
      attemptId: 'attempt-1',
      topicId: 'topic-1',
      analysisId: 'analysis-1',
      strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
      primaryTechnique: technique,
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
      decisionReason: 'MVP policy',
      policyVersion: 'socratic-policy.mvp.v1',
      createdAt: new Date('2026-08-04T10:00:00.000Z'),
      ...patch,
    }
  }

  it.each([
    {
      technique: TeachingTechnique.TRACE_EXECUTION,
      level: ExplanationDetailLevel.CONCISE,
      expectedMessage:
        'Let us narrow it to one trace step. What value changes first?',
    },
    {
      technique: TeachingTechnique.TRACE_EXECUTION,
      level: ExplanationDetailLevel.STANDARD,
      expectedMessage:
        'Let us narrow it to one trace step. What value changes first, and what did you expect it to become?',
    },
    {
      technique: TeachingTechnique.TRACE_EXECUTION,
      level: ExplanationDetailLevel.DETAILED,
      expectedMessage:
        'Let us trace the execution carefully step by step. What value changes first, and what did you expect it to become at that point?',
    },
    {
      technique: TeachingTechnique.SELF_EXPLANATION,
      level: ExplanationDetailLevel.CONCISE,
      expectedMessage:
        'In your own words, what part are you most confident about so far?',
    },
    {
      technique: TeachingTechnique.SELF_EXPLANATION,
      level: ExplanationDetailLevel.STANDARD,
      expectedMessage:
        'Let us pause at one step. In your own words, what part are you most confident about so far?',
    },
    {
      technique: TeachingTechnique.SELF_EXPLANATION,
      level: ExplanationDetailLevel.DETAILED,
      expectedMessage:
        'Let us pause to review your reasoning step by step. In your own words, what part of your approach are you most confident about so far?',
    },
    {
      technique: TeachingTechnique.ORIENTATION_QUESTION,
      level: ExplanationDetailLevel.CONCISE,
      expectedMessage:
        'Let us break this down. What is the starting value or condition to check first?',
    },
    {
      technique: TeachingTechnique.ORIENTATION_QUESTION,
      level: ExplanationDetailLevel.STANDARD,
      expectedMessage:
        'Let us break this down into one step. What is the first value or condition to check?',
    },
    {
      technique: TeachingTechnique.ORIENTATION_QUESTION,
      level: ExplanationDetailLevel.DETAILED,
      expectedMessage:
        'Let us break this problem down into smaller steps. What is the starting value or condition you should look at first?',
    },
  ])(
    'produces safe fallback message for $technique at $level level',
    ({ technique, level, expectedMessage }) => {
      const decision = baseDecision(technique)
      const fallback = service.create(decision, level)

      expect(fallback.message).toBe(expectedMessage)
      expect(fallback.source).toBe(APPROVED_RESPONSE_SOURCE.SAFE_FALLBACK)
      expect(fallback.safeFallbackUsed).toBe(true)
      expect(fallback.requiresStudentAction).toBe(true)
      expect(fallback.usedCitationIds).toEqual([])
      expect(fallback.approvalMetadata.promptVersion).toBe(
        SAFE_FALLBACK_PROMPT_VERSION,
      )
    },
  )

  it('falls back to STANDARD message when an invalid preference level is provided', () => {
    const decision = baseDecision(TeachingTechnique.ORIENTATION_QUESTION)
    const fallback = service.create(
      decision,
      'UNKNOWN_LEVEL' as unknown as ExplanationDetailLevel,
    )

    expect(fallback.message).toBe(
      'Let us break this down into one step. What is the first value or condition to check?',
    )
  })

  it.each([
    {
      purpose: StudentActionPurpose.PRIOR_ATTEMPT_ORIENTATION,
      technique: TeachingTechnique.ORIENTATION_QUESTION,
      expectedMessage:
        'Let us check your reasoning. What was the first step you considered?',
      expectedDescription: 'describe what they tried',
    },
    {
      purpose: StudentActionPurpose.CONCEPTUAL_UNDERSTANDING,
      technique: TeachingTechnique.ORIENTATION_QUESTION,
      expectedMessage:
        'Let us explore the core concept. How would you explain what this concept does in your own words?',
      expectedDescription: 'conceptual understanding question',
    },
    {
      purpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
      technique: TeachingTechnique.FOCUSED_QUESTION,
      expectedMessage:
        'Let us break this down into one step. What is the first value or condition to check?',
      expectedDescription: 'FOCUSED_QUESTION reasoning question',
    },
  ])(
    'uses the resolved $purpose obligation',
    ({ purpose, technique, expectedMessage, expectedDescription }) => {
      const response = service.create(
        baseDecision(technique, {
          studentActionPurpose: purpose,
          primaryTechnique: technique,
        }),
      )

      expect(response.message).toBe(expectedMessage)
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
