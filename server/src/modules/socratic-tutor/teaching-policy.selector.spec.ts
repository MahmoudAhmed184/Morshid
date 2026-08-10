import {
  MessageRequestKind,
  ReflectionMode,
  RevealPolicy,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../../generated/prisma/client'
import type { PersistedEducationalAnalysisRecord } from './educational-analysis.repository'
import {
  EDUCATIONAL_ANALYSIS_SOURCE,
  EFFORT_QUALITY,
  EFFORT_TYPE,
  LEARNING_EVIDENCE_STRENGTH,
} from './educational-analysis.types'
import {
  calculateGuidanceLevel,
  fixedTeachingGuardPolicy,
  primaryTechniqueForStrategy,
  selectTeachingDecisionDraft,
  selectTeachingStrategy,
  teachingPolicyDefaults,
} from './teaching-policy.selector'
import type { PreviousTeachingDecisionSnapshot } from './teaching-policy.types'
import type { TopicStateSnapshot } from './topic-state.types'
import { TOPIC_RESOLUTION_OUTCOME } from './topic.types'

describe('teaching policy selector', () => {
  it.each([
    [StudentState.NO_PRIOR_KNOWLEDGE, TeachingStrategy.GUIDED_EXPLANATION],
    [StudentState.PARTIAL_UNDERSTANDING, TeachingStrategy.SOCRATIC_QUESTIONING],
    [StudentState.MISCONCEPTION, TeachingStrategy.MISCONCEPTION_REPAIR],
    [StudentState.DEBUGGING_ISSUE, TeachingStrategy.DEBUGGING_GUIDANCE],
    [StudentState.NEAR_SOLUTION, TeachingStrategy.SOCRATIC_QUESTIONING],
    [StudentState.UNKNOWN, TeachingStrategy.SOCRATIC_QUESTIONING],
  ])('maps %s to %s', (studentState, strategy) => {
    expect(
      selectTeachingStrategy({
        analysis: analysis({ studentState }),
        previousTeachingDecision: null,
      }),
    ).toBe(strategy)
  })

  it('preserves an eligible previous strategy for a near-solution turn', () => {
    expect(
      selectTeachingStrategy({
        analysis: analysis({ studentState: StudentState.NEAR_SOLUTION }),
        previousTeachingDecision: previousDecision({
          strategy: TeachingStrategy.DEBUGGING_GUIDANCE,
        }),
      }),
    ).toBe(TeachingStrategy.DEBUGGING_GUIDANCE)
  })

  it('does not preserve an incompatible previous strategy', () => {
    expect(
      selectTeachingStrategy({
        analysis: analysis({ studentState: StudentState.NEAR_SOLUTION }),
        previousTeachingDecision: previousDecision({
          strategy: 'MODEL_RECOMMENDED_SHORTCUT' as TeachingStrategy,
        }),
      }),
    ).toBe(TeachingStrategy.SOCRATIC_QUESTIONING)
  })

  it.each([
    [
      TeachingStrategy.GUIDED_EXPLANATION,
      TeachingTechnique.ORIENTATION_QUESTION,
    ],
    [TeachingStrategy.SOCRATIC_QUESTIONING, TeachingTechnique.FOCUSED_QUESTION],
    [TeachingStrategy.MISCONCEPTION_REPAIR, TeachingTechnique.COUNTEREXAMPLE],
    [TeachingStrategy.DEBUGGING_GUIDANCE, TeachingTechnique.TRACE_EXECUTION],
  ])('maps %s to primary technique %s', (strategy, technique) => {
    expect(primaryTechniqueForStrategy(strategy)).toBe(technique)
    expect(
      selectTeachingDecisionDraft({
        analysis: analysis({ studentState: StudentState.DEBUGGING_ISSUE }),
        topicState: topicState(),
        previousTeachingDecision: previousDecision({ strategy }),
      }).supportingTechnique,
    ).toBeNull()
  })

  it('starts new topics at guidance level 1', () => {
    expect(
      guidance({
        analysis: analysis({
          topicRelation: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
        }),
      }),
    ).toBe(1)
  })

  it('keeps fallback analysis at guidance level 1', () => {
    expect(
      guidance({
        analysis: analysis({
          analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK,
        }),
      }),
    ).toBe(1)
  })

  it('keeps unknown student state at guidance level 1', () => {
    expect(
      guidance({ analysis: analysis({ studentState: StudentState.UNKNOWN }) }),
    ).toBe(1)
  })

  it('uses guidance level 1 when there is no previous guidance state', () => {
    expect(
      calculateGuidanceLevel({
        analysis: analysis(),
        topicState: null,
        previousTeachingDecision: null,
      }),
    ).toBe(1)
  })

  it('increases guidance by one for meaningful effort while blocked', () => {
    expect(guidance({ currentLevel: 2 })).toBe(3)
  })

  it('never increases guidance by more than one per turn', () => {
    expect(guidance({ currentLevel: 1 })).toBe(2)
  })

  it('never exceeds guidance level 4', () => {
    expect(guidance({ currentLevel: 4 })).toBe(4)
  })

  it('keeps the current level when there is no meaningful effort', () => {
    expect(
      guidance({
        currentLevel: 3,
        analysis: analysis({ effortQuality: EFFORT_QUALITY.LOW }),
      }),
    ).toBe(3)
  })

  it.each([
    ['repeated effort', { effortIsRepeated: true }],
    ['effort unrelated to the prior tutor action', { effortAddressesPreviousTutorAction: false }],
    ['effort without current-message evidence', { effortEvidenceMessageIds: ['older-message'] }],
    ['effort without a supported type', { effortType: null }],
  ])('does not escalate for %s', (_label, analysisInput) => {
    expect(
      guidance({
        currentLevel: 2,
        analysis: analysis(analysisInput),
      }),
    ).toBe(2)
  })

  it('de-escalates by one for current-message-supported learning evidence', () => {
    expect(
      guidance({
        currentLevel: 3,
        analysis: analysis({
          learningPresent: true,
          learningStrength: LEARNING_EVIDENCE_STRENGTH.STRONG,
          learningEvidenceMessageIds: ['message-1'],
        }),
      }),
    ).toBe(2)
  })

  it('does not de-escalate for unsupported learning self-report', () => {
    expect(
      guidance({
        currentLevel: 3,
        analysis: analysis({
          learningPresent: true,
          learningStrength: LEARNING_EVIDENCE_STRENGTH.STRONG,
          learningEvidenceMessageIds: [],
        }),
      }),
    ).toBe(4)
  })

  it('does not escalate for direct-answer pressure alone', () => {
    expect(
      guidance({
        currentLevel: 2,
        analysis: analysis({
          requestKind: MessageRequestKind.PROBLEM_LIKE,
          effortPresent: false,
          effortQuality: EFFORT_QUALITY.NONE,
        }),
      }),
    ).toBe(2)
  })

  it('resets guidance to level 1 on topic change', () => {
    expect(
      guidance({
        previous: previousDecision({ topicId: 'topic-previous' }),
      }),
    ).toBe(1)
  })

  it.each([
    TOPIC_RESOLUTION_OUTCOME.RESUME_PREVIOUS_TOPIC,
    TOPIC_RESOLUTION_OUTCOME.REOPEN_EXISTING_TOPIC,
  ])('restores guidance without escalating on %s', (outcome) => {
    expect(
      calculateGuidanceLevel({
        analysis: analysis(),
        topicState: topicState({ guidanceLevel: 1 }),
        previousTeachingDecision: previousDecision({ guidanceLevel: 3 }),
        topicResolutionOutcome: outcome,
      }),
    ).toBe(3)
  })

  it('ignores stale TopicState guidance when no prior decision exists', () => {
    expect(
      calculateGuidanceLevel({
        analysis: analysis(),
        topicState: topicState({ guidanceLevel: 4 }),
        previousTeachingDecision: null,
        topicResolutionOutcome:
          TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      }),
    ).toBe(1)
  })

  it('fails conservatively on authoritative topic conflict', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis({
        topicRelation: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
      }),
      topicState: topicState({ guidanceLevel: 4 }),
      previousTeachingDecision: previousDecision({ guidanceLevel: 4 }),
      topicResolutionOutcome:
        TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
    })

    expect(draft).toMatchObject({
      strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
      guidanceLevel: 1,
      revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
      requireStudentAction: true,
    })
    expect(draft.decisionReason).toContain('authoritative TopicResolution')
  })

  it('preserves strategy continuity without a supported transition', () => {
    expect(
      selectTeachingStrategy({
        analysis: analysis({
          studentState: StudentState.PARTIAL_UNDERSTANDING,
        }),
        previousTeachingDecision: previousDecision({
          strategy: TeachingStrategy.GUIDED_EXPLANATION,
        }),
        topicResolutionOutcome:
          TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      }),
    ).toBe(TeachingStrategy.GUIDED_EXPLANATION)
  })

  it('does not escalate near-solution turns', () => {
    expect(
      guidance({
        currentLevel: 2,
        analysis: analysis({ studentState: StudentState.NEAR_SOLUTION }),
      }),
    ).toBe(2)
  })

  it('uses fixed reveal, reflection, and guard defaults', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis(),
      topicState: topicState({ guidanceLevel: 3 }),
      previousTeachingDecision: previousDecision({ guidanceLevel: 3 }),
      courseTutorConfiguration: null,
    })

    expect(draft).toMatchObject({
      revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
      reflectionMode: ReflectionMode.NONE,
      requireStudentAction: true,
      guardPolicy: fixedTeachingGuardPolicy(),
    })
    expect(teachingPolicyDefaults()).toEqual({
      maximumGuidanceLevel: 4,
      defaultRevealPolicy: RevealPolicy.NO_FINAL_ANSWER,
      reflectionEnabled: false,
    })
  })

  it('allows guidance level 4 with no-final-answer reveal policy', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis(),
      topicState: topicState({ guidanceLevel: 3 }),
      previousTeachingDecision: previousDecision({ guidanceLevel: 3 }),
    })

    expect(draft.guidanceLevel).toBe(4)
    expect(draft.revealPolicy).toBe(RevealPolicy.NO_FINAL_ANSWER)
  })
})

function guidance(input: {
  analysis?: PersistedEducationalAnalysisRecord
  currentLevel?: number
  previous?: PreviousTeachingDecisionSnapshot | null
}): number {
  const currentLevel = input.currentLevel ?? 2

  return calculateGuidanceLevel({
    analysis: input.analysis ?? analysis(),
    topicState: topicState({ guidanceLevel: currentLevel }),
    previousTeachingDecision:
      input.previous === undefined
        ? previousDecision({ guidanceLevel: currentLevel })
        : input.previous,
  })
}

function analysis(
  input: Partial<{
    analysisSource: PersistedEducationalAnalysisRecord['analysisSource']
    effortPresent: boolean
    effortQuality: PersistedEducationalAnalysisRecord['result']['effortEvidence']['quality']
    effortType: PersistedEducationalAnalysisRecord['result']['effortEvidence']['type']
    effortAddressesPreviousTutorAction: boolean
    effortIsRepeated: boolean
    effortEvidenceMessageIds: string[]
    learningPresent: boolean
    learningStrength: PersistedEducationalAnalysisRecord['result']['learningEvidence']['strength']
    learningEvidenceMessageIds: string[]
    requestKind: MessageRequestKind
    studentState: StudentState
    topicRelation: PersistedEducationalAnalysisRecord['result']['topicRelation']
  }> = {},
): PersistedEducationalAnalysisRecord {
  return {
    id: 'analysis-1',
    turnId: 'turn-1',
    topicId: 'topic-1',
    studentMessageId: 'message-1',
    attempt: 1,
    result: {
      requestKind: input.requestKind ?? MessageRequestKind.CODE_DIAGNOSIS,
      studentState: input.studentState ?? StudentState.DEBUGGING_ISSUE,
      effortEvidence: {
        present: input.effortPresent ?? true,
        quality: input.effortQuality ?? EFFORT_QUALITY.MEANINGFUL,
        type:
          input.effortType === undefined
            ? EFFORT_TYPE.CODE_ATTEMPT
            : input.effortType,
        addressesPreviousTutorAction:
          input.effortAddressesPreviousTutorAction ?? true,
        isRepeated: input.effortIsRepeated ?? false,
        evidenceMessageIds: input.effortEvidenceMessageIds ?? ['message-1'],
      },
      learningEvidence: {
        present: input.learningPresent ?? false,
        strength:
          input.learningStrength ?? LEARNING_EVIDENCE_STRENGTH.NONE,
        evidenceMessageIds: input.learningEvidenceMessageIds ?? [],
      },
      misconceptions: [],
      topicRelation:
        input.topicRelation ?? TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      recommendedStrategy: TeachingStrategy.GUIDED_EXPLANATION,
      recommendedTechnique: TeachingTechnique.ORIENTATION_QUESTION,
      recommendedGuidanceLevel: 4,
      confidence: 0.9,
      evidenceReferences: ['message-1'],
    },
    provider: 'test',
    model: 'test',
    modelVersion: null,
    promptVersion: 'test',
    schemaVersion: 'test',
    inputTokens: null,
    outputTokens: null,
    latencyMs: null,
    analysisSource: input.analysisSource ?? EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
    fallbackReason: null,
    failureCategory: null,
    confidencePolicyVersion: null,
    infrastructureRetryCount: 0,
    evidenceLinks: [],
    misconceptionRecords: [],
    createdAt: new Date('2026-08-05T00:00:00.000Z'),
  }
}

function topicState(
  input: Partial<TopicStateSnapshot> = {},
): TopicStateSnapshot {
  return {
    id: 'topic-state-1',
    topicId: 'topic-1',
    version: 1,
    requestKind: null,
    studentState: StudentState.UNKNOWN,
    activeStrategy: null,
    primaryTechnique: null,
    supportingTechnique: null,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    attemptCount: 0,
    meaningfulAttemptCount: 0,
    misconceptionStatus: null,
    learningStatus: 'UNKNOWN',
    resolutionEvidenceStrength: 'NONE',
    summary: null,
    lastTutorQuestion: null,
    lastStudentAction: null,
    resolved: false,
    updatedAt: new Date('2026-08-05T00:00:00.000Z'),
    ...input,
  }
}

function previousDecision(
  input: Partial<PreviousTeachingDecisionSnapshot> = {},
): PreviousTeachingDecisionSnapshot {
  return {
    id: 'decision-1',
    turnId: 'turn-previous',
    topicId: 'topic-1',
    analysisId: 'analysis-previous',
    strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
    primaryTechnique: TeachingTechnique.FOCUSED_QUESTION,
    supportingTechnique: null,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    reflectionMode: ReflectionMode.NONE,
    requireStudentAction: true,
    guardPolicy: fixedTeachingGuardPolicy(),
    decisionReason: 'Selected Socratic questioning.',
    policyVersion: 'socratic-policy.mvp.v1',
    createdAt: new Date('2026-08-05T00:00:00.000Z'),
    ...input,
  }
}
