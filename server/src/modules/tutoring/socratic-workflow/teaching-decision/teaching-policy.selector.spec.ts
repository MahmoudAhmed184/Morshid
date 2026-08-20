import {
  MessageRequestKind,
  ReflectionMode,
  RevealPolicy,
  StudentActionPurpose,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
import type { PersistedEducationalAnalysisRecord } from '../analysis/educational-analysis.repository'
import {
  EDUCATIONAL_ANALYSIS_SOURCE,
  EFFORT_QUALITY,
  EFFORT_TYPE,
  LEARNING_EVIDENCE_STRENGTH,
} from '../analysis/educational-analysis.types'
import {
  calculateGuidanceLevel,
  fixedTeachingGuardPolicy,
  primaryTechniqueForStrategy,
  selectTeachingDecisionDraft,
  selectTeachingStrategy,
  teachingPolicyDefaults,
} from './teaching-policy.selector'
import type { PreviousTeachingDecisionSnapshot } from './teaching-policy.types'
import type { TopicStateSnapshot } from '../topic/topic-state.types'
import { TOPIC_RESOLUTION_OUTCOME } from '../topic/topic.types'

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

  it('gives a direct conceptual request with unknown student state a bounded explanation decision', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis({
        requestKind: MessageRequestKind.CONCEPTUAL,
        studentState: StudentState.UNKNOWN,
        effortPresent: false,
        effortQuality: EFFORT_QUALITY.NONE,
        effortType: null,
        effortEvidenceMessageIds: [],
      }),
      topicState: topicState(),
      previousTeachingDecision: null,
    })

    expect(draft).toMatchObject({
      strategy: TeachingStrategy.GUIDED_EXPLANATION,
      primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
      supportingTechnique: null,
      guidanceLevel: 1,
      revealPolicy: RevealPolicy.PARTIAL_RESULT_ALLOWED,
      requireStudentAction: true,
      studentActionPurpose: StudentActionPurpose.CONCEPTUAL_UNDERSTANDING,
      guardPolicy: {
        preventDirectAnswer: false,
        preventFinalResult: true,
        preventCompleteSolution: true,
      },
    })
  })

  it('selects primary-technique for first problem turn without prior effort', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis({
        requestKind: MessageRequestKind.PROBLEM_LIKE,
        studentState: StudentState.NO_PRIOR_KNOWLEDGE,
        effortPresent: false,
        effortQuality: EFFORT_QUALITY.NONE,
        effortType: null,
        effortEvidenceMessageIds: [],
      }),
      topicState: topicState(),
      previousTeachingDecision: null,
    })

    expect(draft).toMatchObject({
      primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
      studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
    })
  })

  it('selects prior-attempt orientation for vague or incomplete learner attempts', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis({
        requestKind: MessageRequestKind.PROBLEM_LIKE,
        studentState: StudentState.NO_PRIOR_KNOWLEDGE,
        effortPresent: true,
        effortQuality: EFFORT_QUALITY.LOW,
        effortType: null,
        effortEvidenceMessageIds: ['message-1'],
      }),
      topicState: topicState(),
      previousTeachingDecision: null,
    })

    expect(draft).toMatchObject({
      primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
      studentActionPurpose: StudentActionPurpose.PRIOR_ATTEMPT_ORIENTATION,
    })
  })

  it('selects primary-technique for a concrete reasoning attempt', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis({
        requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
        studentState: StudentState.PARTIAL_UNDERSTANDING,
        effortPresent: true,
        effortQuality: EFFORT_QUALITY.MEANINGFUL,
        effortType: EFFORT_TYPE.REASONING_ATTEMPT,
        effortEvidenceMessageIds: ['message-1'],
      }),
      topicState: topicState(),
      previousTeachingDecision: null,
    })

    expect(draft).toMatchObject({
      strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
      primaryTechnique: TeachingTechnique.FOCUSED_QUESTION,
      studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
    })
  })

  it('reconciles previous GUIDED_EXPLANATION to SOCRATIC_QUESTIONING + FOCUSED_QUESTION on meaningful partial progress', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis({
        requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
        studentState: StudentState.PARTIAL_UNDERSTANDING,
        effortPresent: true,
        effortQuality: EFFORT_QUALITY.MEANINGFUL,
        effortType: EFFORT_TYPE.REASONING_ATTEMPT,
        effortEvidenceMessageIds: ['message-1'],
      }),
      topicState: topicState({ guidanceLevel: 2 }),
      previousTeachingDecision: previousDecision({
        strategy: TeachingStrategy.GUIDED_EXPLANATION,
        primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
        guidanceLevel: 2,
      }),
    })

    expect(draft).toMatchObject({
      strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
      primaryTechnique: TeachingTechnique.FOCUSED_QUESTION,
      requireStudentAction: true,
      studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
    })
  })

  it('reconciles previous GUIDED_EXPLANATION to SOCRATIC_QUESTIONING + VERIFICATION on verified near-solution progress with requireStudentAction false', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis({
        requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
        studentState: StudentState.NEAR_SOLUTION,
        effortPresent: true,
        effortQuality: EFFORT_QUALITY.STRONG,
        effortType: EFFORT_TYPE.REASONING_ATTEMPT,
        effortEvidenceMessageIds: ['message-1'],
        learningPresent: true,
        learningStrength: LEARNING_EVIDENCE_STRENGTH.STRONG,
        learningEvidenceMessageIds: ['message-1'],
      }),
      topicState: topicState({ guidanceLevel: 2 }),
      previousTeachingDecision: previousDecision({
        strategy: TeachingStrategy.GUIDED_EXPLANATION,
        primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
        guidanceLevel: 2,
      }),
    })

    expect(draft).toMatchObject({
      strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
      primaryTechnique: TeachingTechnique.VERIFICATION,
      guidanceLevel: 1,
      requireStudentAction: false,
      studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
    })
    expect(draft.decisionReason).toContain(
      'current-message-supported learning evidence demonstrated correct progress toward solution',
    )
  })

  it('requires student action when near-solution progress lacks current verified learning evidence', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis({
        requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
        studentState: StudentState.NEAR_SOLUTION,
        effortPresent: true,
        effortQuality: EFFORT_QUALITY.MEANINGFUL,
        effortType: EFFORT_TYPE.REASONING_ATTEMPT,
        effortEvidenceMessageIds: ['message-1'],
        learningPresent: false,
      }),
      topicState: topicState({ guidanceLevel: 2 }),
      previousTeachingDecision: previousDecision({
        strategy: TeachingStrategy.GUIDED_EXPLANATION,
        primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
        guidanceLevel: 2,
      }),
    })

    expect(draft).toMatchObject({
      strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
      primaryTechnique: TeachingTechnique.FOCUSED_QUESTION,
      requireStudentAction: true,
      studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
    })
  })

  it('selects primary-technique for explicit struggle without effort', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis({
        requestKind: MessageRequestKind.PROBLEM_LIKE,
        studentState: StudentState.NO_PRIOR_KNOWLEDGE,
        effortPresent: false,
        effortQuality: EFFORT_QUALITY.NONE,
        effortType: null,
        effortEvidenceMessageIds: [],
      }),
      topicState: topicState({ guidanceLevel: 2 }),
      previousTeachingDecision: previousDecision({ guidanceLevel: 1 }),
    })

    expect(draft).toMatchObject({
      studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
    })
  })

  it('keeps a focused problem-like turn on the primary-technique action', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis({
        requestKind: MessageRequestKind.PROBLEM_LIKE,
        studentState: StudentState.UNKNOWN,
        effortPresent: false,
        effortQuality: EFFORT_QUALITY.NONE,
        effortType: null,
        effortEvidenceMessageIds: [],
      }),
      topicState: topicState(),
      previousTeachingDecision: null,
    })

    expect(draft).toMatchObject({
      strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
      primaryTechnique: TeachingTechnique.FOCUSED_QUESTION,
      guidanceLevel: 1,
      studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
    })
  })

  it('does not let fallback analysis suppress an ordinary conceptual explanation', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis({
        analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK,
        requestKind: MessageRequestKind.CONCEPTUAL,
        studentState: StudentState.UNKNOWN,
        effortPresent: false,
        effortQuality: EFFORT_QUALITY.NONE,
        effortType: null,
        effortEvidenceMessageIds: [],
      }),
      topicState: topicState(),
      previousTeachingDecision: null,
    })

    expect(draft).toMatchObject({
      strategy: TeachingStrategy.GUIDED_EXPLANATION,
      primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
      guidanceLevel: 1,
      revealPolicy: RevealPolicy.PARTIAL_RESULT_ALLOWED,
      guardPolicy: { preventDirectAnswer: false },
    })
    expect(draft.decisionReason).toContain('direct conceptual request')
  })

  it.each([
    {
      label: 'problem-like request',
      input: {
        analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK,
        requestKind: MessageRequestKind.PROBLEM_LIKE,
        studentState: StudentState.UNKNOWN,
        effortPresent: false,
        effortQuality: EFFORT_QUALITY.NONE,
        effortType: null,
        effortEvidenceMessageIds: [],
      },
      strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
    },
    {
      label: 'student attempt',
      input: {
        requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
        studentState: StudentState.PARTIAL_UNDERSTANDING,
      },
      strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
    },
    {
      label: 'code debugging request',
      input: {
        requestKind: MessageRequestKind.CODE_DIAGNOSIS,
        studentState: StudentState.DEBUGGING_ISSUE,
      },
      strategy: TeachingStrategy.DEBUGGING_GUIDANCE,
    },
  ])('preserves protected policy for $label', ({ input, strategy }) => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis(input),
      topicState: topicState(),
      previousTeachingDecision: null,
    })

    expect(draft).toMatchObject({
      strategy,
      revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
      guardPolicy: { preventDirectAnswer: true },
    })
  })

  it('preserves misconception repair for a conceptual misconception', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis({
        requestKind: MessageRequestKind.CONCEPTUAL,
        studentState: StudentState.MISCONCEPTION,
        misconceptions: [
          {
            code: 'BREAK_CONTINUE_REVERSAL',
            description: 'The student reverses break and continue behavior.',
            confidence: 0.95,
            evidenceMessageId: 'message-1',
          },
        ],
      }),
      topicState: topicState(),
      previousTeachingDecision: null,
    })

    expect(draft).toMatchObject({
      strategy: TeachingStrategy.MISCONCEPTION_REPAIR,
      primaryTechnique: TeachingTechnique.COUNTEREXAMPLE,
      revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
      guardPolicy: { preventDirectAnswer: true },
    })
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

  it('leaves misconception repair for verification after a supported correction', () => {
    const draft = selectTeachingDecisionDraft({
      analysis: analysis({
        requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
        studentState: StudentState.NEAR_SOLUTION,
        learningPresent: true,
        learningStrength: LEARNING_EVIDENCE_STRENGTH.STRONG,
        learningEvidenceMessageIds: ['message-1'],
      }),
      topicState: topicState({ guidanceLevel: 2 }),
      previousTeachingDecision: previousDecision({
        strategy: TeachingStrategy.MISCONCEPTION_REPAIR,
        primaryTechnique: TeachingTechnique.COUNTEREXAMPLE,
        guidanceLevel: 2,
      }),
    })

    expect(draft).toMatchObject({
      strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
      primaryTechnique: TeachingTechnique.VERIFICATION,
      guidanceLevel: 1,
    })
    expect(draft.decisionReason).toContain(
      'strong current-message-supported learning evidence corrected the active misconception',
    )
  })

  it('preserves misconception repair without supported current-message correction', () => {
    const previous = previousDecision({
      strategy: TeachingStrategy.MISCONCEPTION_REPAIR,
      primaryTechnique: TeachingTechnique.COUNTEREXAMPLE,
      guidanceLevel: 2,
    })

    for (const currentAnalysis of [
      analysis({
        requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
        studentState: StudentState.NEAR_SOLUTION,
        learningPresent: false,
      }),
      analysis({
        requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
        studentState: StudentState.MISCONCEPTION,
        learningPresent: true,
        learningStrength: LEARNING_EVIDENCE_STRENGTH.STRONG,
        learningEvidenceMessageIds: ['message-1'],
        misconceptions: [
          {
            code: 'BREAK_CONTINUE_REVERSAL',
            description: 'The distinction remains reversed.',
            confidence: 0.95,
            evidenceMessageId: 'message-1',
          },
        ],
      }),
    ]) {
      expect(
        selectTeachingDecisionDraft({
          analysis: currentAnalysis,
          topicState: topicState({ guidanceLevel: 2 }),
          previousTeachingDecision: previous,
        }),
      ).toMatchObject({
        strategy: TeachingStrategy.MISCONCEPTION_REPAIR,
        primaryTechnique: TeachingTechnique.COUNTEREXAMPLE,
      })
    }
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
    [
      'effort unrelated to the prior tutor action',
      { effortAddressesPreviousTutorAction: false },
    ],
    [
      'effort without current-message evidence',
      { effortEvidenceMessageIds: ['older-message'] },
    ],
    ['effort without a supported type', { effortType: null }],
  ])('does not escalate for %s', (_label, analysisInput) => {
    expect(
      guidance({
        currentLevel: 2,
        analysis: analysis(analysisInput),
      }),
    ).toBe(2)
  })

  it('escalates guidance level for current-turn explicit struggle (NO_PRIOR_KNOWLEDGE)', () => {
    expect(
      guidance({
        currentLevel: 1,
        analysis: analysis({
          studentState: StudentState.NO_PRIOR_KNOWLEDGE,
          effortPresent: false,
          effortQuality: EFFORT_QUALITY.NONE,
          effortType: null,
          effortIsRepeated: false,
        }),
      }),
    ).toBe(2)
  })

  it('does not escalate beyond Level 2 for repeated struggle without new learner evidence', () => {
    expect(
      guidance({
        currentLevel: 2,
        analysis: analysis({
          studentState: StudentState.NO_PRIOR_KNOWLEDGE,
          effortPresent: false,
          effortQuality: EFFORT_QUALITY.NONE,
          effortType: null,
          effortIsRepeated: false,
        }),
      }),
    ).toBe(2)
  })

  it('does not escalate for repeated retry of explicit struggle', () => {
    expect(
      guidance({
        currentLevel: 2,
        analysis: analysis({
          studentState: StudentState.NO_PRIOR_KNOWLEDGE,
          effortPresent: false,
          effortQuality: EFFORT_QUALITY.NONE,
          effortType: null,
          effortIsRepeated: true,
        }),
      }),
    ).toBe(2)
  })

  it('de-escalates by one for current-message-supported learning evidence', () => {
    expect(
      guidance({
        currentLevel: 3,
        analysis: analysis({
          effortPresent: false,
          effortQuality: EFFORT_QUALITY.NONE,
          effortType: null,
          learningPresent: true,
          learningStrength: LEARNING_EVIDENCE_STRENGTH.STRONG,
          learningEvidenceMessageIds: ['message-1'],
        }),
      }),
    ).toBe(2)
  })

  it('prioritizes qualifying blocked-state effort when learning evidence is simultaneous', () => {
    expect(
      guidance({
        currentLevel: 1,
        analysis: analysis({
          studentState: StudentState.MISCONCEPTION,
          learningPresent: true,
          learningStrength: LEARNING_EVIDENCE_STRENGTH.MODERATE,
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
        topicResolutionOutcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
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
      topicResolutionOutcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
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
          studentState: StudentState.NO_PRIOR_KNOWLEDGE,
          effortPresent: false,
          effortQuality: EFFORT_QUALITY.NONE,
          effortType: null,
          effortEvidenceMessageIds: [],
        }),
        previousTeachingDecision: previousDecision({
          strategy: TeachingStrategy.GUIDED_EXPLANATION,
        }),
        topicResolutionOutcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
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

  describe('decision reasons', () => {
    it('describes supported escalation', () => {
      const draft = selectTeachingDecisionDraft({
        analysis: analysis(),
        topicState: topicState({ guidanceLevel: 2 }),
        previousTeachingDecision: previousDecision({ guidanceLevel: 2 }),
      })

      expect(draft.guidanceLevel).toBe(3)
      expect(draft.decisionReason).toContain(
        'Escalated guidance by one after meaningful, relevant, non-repeated effort addressing the prior tutor action.',
      )
    })

    it('describes verified-learning de-escalation', () => {
      const draft = selectTeachingDecisionDraft({
        analysis: analysis({
          effortPresent: false,
          effortQuality: EFFORT_QUALITY.NONE,
          effortType: null,
          effortEvidenceMessageIds: [],
          learningPresent: true,
          learningStrength: LEARNING_EVIDENCE_STRENGTH.STRONG,
          learningEvidenceMessageIds: ['message-1'],
        }),
        topicState: topicState({ guidanceLevel: 3 }),
        previousTeachingDecision: previousDecision({ guidanceLevel: 3 }),
      })

      expect(draft.guidanceLevel).toBe(2)
      expect(draft.decisionReason).toContain(
        'De-escalated guidance after current-message-supported learning evidence.',
      )
    })

    it.each([
      [
        'fallback analysis',
        {
          analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK,
          studentState: StudentState.PARTIAL_UNDERSTANDING,
        },
        'Applied conservative Level 1 guidance because fallback analysis cannot support stateful recalibration.',
      ],
      [
        'unknown student state',
        {
          analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
          studentState: StudentState.UNKNOWN,
        },
        'Applied conservative Level 1 guidance because an unknown student state cannot support stateful recalibration.',
      ],
    ] as const)(
      'describes %s conservative behavior without claiming learning evidence',
      (_label, conservativeInput, expectedReason) => {
        const draft = selectTeachingDecisionDraft({
          analysis: analysis({
            ...conservativeInput,
            effortPresent: false,
            effortQuality: EFFORT_QUALITY.NONE,
            effortType: null,
            effortEvidenceMessageIds: [],
          }),
          topicState: topicState({ guidanceLevel: 2 }),
          previousTeachingDecision: previousDecision({ guidanceLevel: 2 }),
        })

        expect(draft.guidanceLevel).toBe(1)
        expect(draft.decisionReason).toContain(expectedReason)
        expect(draft.decisionReason).not.toContain('learning evidence')
      },
    )

    it('distinguishes authoritative topic conflict from a normal topic reset', () => {
      const conflict = selectTeachingDecisionDraft({
        analysis: analysis({
          topicRelation: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
        }),
        topicState: topicState({ guidanceLevel: 3 }),
        previousTeachingDecision: previousDecision({ guidanceLevel: 3 }),
        topicResolutionOutcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      })
      const reset = selectTeachingDecisionDraft({
        analysis: analysis({
          topicRelation: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
        }),
        topicState: topicState({ guidanceLevel: 3 }),
        previousTeachingDecision: previousDecision({ guidanceLevel: 3 }),
        topicResolutionOutcome: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
      })

      expect(conflict.decisionReason).toContain(
        'authoritative TopicResolution conflicts',
      )
      expect(reset.guidanceLevel).toBe(1)
      expect(reset.decisionReason).toContain(
        'Reset guidance to Level 1 for the authoritative new or switched topic.',
      )
      expect(reset.decisionReason).not.toContain('learning evidence')
    })

    it('describes preserved same-topic guidance', () => {
      const draft = selectTeachingDecisionDraft({
        analysis: analysis({
          effortPresent: false,
          effortQuality: EFFORT_QUALITY.NONE,
          effortType: null,
          effortEvidenceMessageIds: [],
        }),
        topicState: topicState({ guidanceLevel: 2 }),
        previousTeachingDecision: previousDecision({ guidanceLevel: 2 }),
      })

      expect(draft.guidanceLevel).toBe(2)
      expect(draft.decisionReason).toContain(
        'Preserved the latest completed same-topic guidance.',
      )
    })

    it.each([
      TOPIC_RESOLUTION_OUTCOME.RESUME_PREVIOUS_TOPIC,
      TOPIC_RESOLUTION_OUTCOME.REOPEN_EXISTING_TOPIC,
    ])('describes guidance restoration for %s', (outcome) => {
      const draft = selectTeachingDecisionDraft({
        analysis: analysis(),
        topicState: topicState({ guidanceLevel: 1 }),
        previousTeachingDecision: previousDecision({ guidanceLevel: 3 }),
        topicResolutionOutcome: outcome,
      })

      expect(draft.guidanceLevel).toBe(3)
      expect(draft.decisionReason).toContain(
        'Restored the latest completed same-topic guidance without recalibration.',
      )
    })
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
    misconceptions: PersistedEducationalAnalysisRecord['result']['misconceptions']
  }> = {},
): PersistedEducationalAnalysisRecord {
  return {
    id: 'analysis-1',
    attemptId: 'turn-1',
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
        strength: input.learningStrength ?? LEARNING_EVIDENCE_STRENGTH.NONE,
        evidenceMessageIds: input.learningEvidenceMessageIds ?? [],
      },
      misconceptions: input.misconceptions ?? [],
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
    attemptId: 'turn-previous',
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
    studentActionPurpose:
      input.studentActionPurpose ?? StudentActionPurpose.PRIMARY_TECHNIQUE,
  }
}
