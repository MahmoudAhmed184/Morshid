import {
  MessageRequestKind,
  ReflectionMode,
  RevealPolicy,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../tutoring-values'
import type { PersistedEducationalAnalysisRecord } from './educational-analysis.repository'
import {
  EDUCATIONAL_ANALYSIS_SOURCE,
  EFFORT_QUALITY,
  EFFORT_TYPE,
  LEARNING_EVIDENCE_STRENGTH,
} from './educational-analysis.types'
import {
  TeachingDecisionRepository,
  type PersistedTeachingDecisionRecord,
  type StoreTeachingDecisionResult,
} from './teaching-decision.repository'
import {
  TEACHING_POLICY_FAILURE_CATEGORY,
  TeachingPolicyEngine,
} from './teaching-policy.engine'
import { fixedTeachingGuardPolicy } from './teaching-policy.selector'
import { TEACHING_POLICY_VERSION } from './teaching-policy.types'
import type { TopicStateSnapshot } from './topic-state.types'
import { TOPIC_RESOLUTION_OUTCOME } from './topic.types'

describe('TeachingPolicyEngine', () => {
  it('creates a complete TeachingDecision from accepted analysis', async () => {
    const repository = new FakeTeachingDecisionRepository()
    const engine = new TeachingPolicyEngine(repository)

    const result = await engine.selectDecision({
      analysis: analysis(),
      topicState: topicState({ guidanceLevel: 2 }),
      previousTeachingDecision: previousDecision({ guidanceLevel: 2 }),
    })

    expect(result).toMatchObject({
      success: true,
      reused: false,
      decision: {
        attemptId: 'turn-1',
        topicId: 'topic-1',
        analysisId: 'analysis-1',
        strategy: TeachingStrategy.DEBUGGING_GUIDANCE,
        primaryTechnique: TeachingTechnique.TRACE_EXECUTION,
        supportingTechnique: null,
        guidanceLevel: 3,
        revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
        reflectionMode: ReflectionMode.NONE,
        requireStudentAction: true,
        guardPolicy: fixedTeachingGuardPolicy(),
        policyVersion: TEACHING_POLICY_VERSION,
      },
    })
    expect(repository.decisions).toHaveLength(1)
  })

  it('creates a conservative decision from accepted fallback analysis', async () => {
    const repository = new FakeTeachingDecisionRepository()
    const engine = new TeachingPolicyEngine(repository)

    const result = await engine.selectDecision({
      analysis: analysis({
        analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK,
        studentState: StudentState.UNKNOWN,
        effortPresent: false,
        effortQuality: EFFORT_QUALITY.NONE,
      }),
      topicState: topicState({ guidanceLevel: 4 }),
      previousTeachingDecision: previousDecision({ guidanceLevel: 4 }),
    })

    expect(result).toMatchObject({
      success: true,
      decision: {
        strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
        primaryTechnique: TeachingTechnique.FOCUSED_QUESTION,
        guidanceLevel: 1,
        revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
        reflectionMode: ReflectionMode.NONE,
      },
    })
  })

  it('fails safely when the analysis is missing or unaccepted', async () => {
    const repository = new FakeTeachingDecisionRepository('analysis_not_found')
    const engine = new TeachingPolicyEngine(repository)

    await expect(
      engine.selectDecision({
        analysis: analysis(),
        topicState: topicState(),
      }),
    ).resolves.toEqual({
      success: false,
      category: TEACHING_POLICY_FAILURE_CATEGORY.INVALID_CONTEXT,
      errorCode: 'TEACHING_DECISION_ANALYSIS_NOT_ACCEPTED',
    })
  })

  it('fails safely for unrelated turn, topic, or analysis relationships', async () => {
    const repository = new FakeTeachingDecisionRepository(
      'relationship_mismatch',
    )
    const engine = new TeachingPolicyEngine(repository)

    await expect(
      engine.selectDecision({
        analysis: analysis(),
        topicState: topicState(),
      }),
    ).resolves.toEqual({
      success: false,
      category: TEACHING_POLICY_FAILURE_CATEGORY.INVALID_CONTEXT,
      errorCode: 'TEACHING_DECISION_RELATIONSHIP_MISMATCH',
    })
  })

  it('reuses the existing decision for repeated processing', async () => {
    const repository = new FakeTeachingDecisionRepository()
    const engine = new TeachingPolicyEngine(repository)
    const input = {
      analysis: analysis(),
      topicState: topicState({ guidanceLevel: 2 }),
      previousTeachingDecision: previousDecision({ guidanceLevel: 2 }),
    }

    const first = await engine.selectDecision(input)
    const second = await engine.selectDecision(input)

    expect(first).toMatchObject({ success: true, reused: false })
    expect(second).toMatchObject({
      success: true,
      reused: true,
      decision: { id: repository.decisions[0]?.id },
    })
    expect(repository.decisions).toHaveLength(1)
  })

  it('creates a separate decision for another turn', async () => {
    const repository = new FakeTeachingDecisionRepository()
    const engine = new TeachingPolicyEngine(repository)

    await engine.selectDecision({
      analysis: analysis(),
      topicState: topicState(),
    })
    await engine.selectDecision({
      analysis: analysis({
        id: 'analysis-2',
        attemptId: 'turn-2',
        studentMessageId: 'message-2',
      }),
      topicState: topicState(),
    })

    expect(repository.decisions.map((decision) => decision.attemptId)).toEqual([
      'turn-1',
      'turn-2',
    ])
  })

  it('keeps decision reasons bounded and does not mutate TopicState', async () => {
    const repository = new FakeTeachingDecisionRepository()
    const engine = new TeachingPolicyEngine(repository)
    const state = topicState({ guidanceLevel: 3 })
    const before = { ...state }

    const result = await engine.selectDecision({
      analysis: analysis(),
      topicState: state,
      previousTeachingDecision: previousDecision({ guidanceLevel: 3 }),
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.decision.decisionReason.length).toBeLessThanOrEqual(240)
    }
    expect(state).toEqual(before)
  })

  it('uses the authoritative topic resolution instead of model topic relation', async () => {
    const repository = new FakeTeachingDecisionRepository()
    const engine = new TeachingPolicyEngine(repository)

    const result = await engine.selectDecision({
      analysis: analysis(),
      topicState: topicState({ guidanceLevel: 3 }),
      previousTeachingDecision: previousDecision({ guidanceLevel: 3 }),
      topicResolutionOutcome: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
    })

    expect(result).toMatchObject({
      success: true,
      decision: { guidanceLevel: 1 },
    })
  })
})

class FakeTeachingDecisionRepository extends TeachingDecisionRepository {
  readonly decisions: PersistedTeachingDecisionRecord[] = []

  constructor(
    private readonly failure?: 'analysis_not_found' | 'relationship_mismatch',
  ) {
    super()
  }

  findByTurnId(
    attemptId: string,
  ): Promise<PersistedTeachingDecisionRecord | null> {
    return Promise.resolve(
      this.decisions.find((decision) => decision.attemptId === attemptId) ??
        null,
    )
  }

  findLatestCompletedForSameTopicBeforeTurn(): Promise<PersistedTeachingDecisionRecord | null> {
    return Promise.resolve(this.decisions.at(-1) ?? null)
  }

  storeDecision(
    draft: Parameters<TeachingDecisionRepository['storeDecision']>[0],
  ): Promise<StoreTeachingDecisionResult> {
    if (this.failure !== undefined) {
      return Promise.resolve({ kind: this.failure })
    }

    const existing = this.decisions.find(
      (decision) => decision.attemptId === draft.attemptId,
    )
    if (existing !== undefined) {
      return Promise.resolve({ kind: 'reused', decision: existing })
    }

    const decision: PersistedTeachingDecisionRecord = {
      id: `decision-${String(this.decisions.length + 1)}`,
      ...draft,
      createdAt: new Date('2026-08-05T00:00:00.000Z'),
    }
    this.decisions.push(decision)

    return Promise.resolve({ kind: 'created', decision })
  }
}

function analysis(
  input: Partial<{
    id: string
    attemptId: string
    topicId: string
    studentMessageId: string
    analysisSource: PersistedEducationalAnalysisRecord['analysisSource']
    effortPresent: boolean
    effortQuality: PersistedEducationalAnalysisRecord['result']['effortEvidence']['quality']
    studentState: StudentState
  }> = {},
): PersistedEducationalAnalysisRecord {
  return {
    id: input.id ?? 'analysis-1',
    attemptId: input.attemptId ?? 'turn-1',
    topicId: input.topicId ?? 'topic-1',
    studentMessageId: input.studentMessageId ?? 'message-1',
    attempt: 1,
    result: {
      requestKind: MessageRequestKind.CODE_DIAGNOSIS,
      studentState: input.studentState ?? StudentState.DEBUGGING_ISSUE,
      effortEvidence: {
        present: input.effortPresent ?? true,
        quality: input.effortQuality ?? EFFORT_QUALITY.MEANINGFUL,
        type: EFFORT_TYPE.CODE_ATTEMPT,
        addressesPreviousTutorAction: true,
        isRepeated: false,
        evidenceMessageIds: [input.studentMessageId ?? 'message-1'],
      },
      learningEvidence: {
        present: false,
        strength: LEARNING_EVIDENCE_STRENGTH.NONE,
        evidenceMessageIds: [],
      },
      misconceptions: [],
      topicRelation: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      recommendedStrategy: TeachingStrategy.GUIDED_EXPLANATION,
      recommendedTechnique: TeachingTechnique.ORIENTATION_QUESTION,
      recommendedGuidanceLevel: 4,
      confidence: 0.9,
      evidenceReferences: [input.studentMessageId ?? 'message-1'],
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
  input: Partial<PersistedTeachingDecisionRecord> = {},
): PersistedTeachingDecisionRecord {
  return {
    id: 'decision-previous',
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
    policyVersion: TEACHING_POLICY_VERSION,
    createdAt: new Date('2026-08-05T00:00:00.000Z'),
    ...input,
  }
}
