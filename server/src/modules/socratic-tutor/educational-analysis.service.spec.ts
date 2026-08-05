import {
  EducationalAnalysisEvidenceKind,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
  TopicStatus,
  TopicType,
} from '../../generated/prisma/client'
import type { AnalysisContextPackage } from './analysis-context.types'
import {
  ANALYSIS_MODEL_ERROR_CODE,
  type AnalysisModelPort,
  type AnalysisModelRequest,
  type AnalysisModelResponse,
  AnalysisModelError,
} from './analysis-model.port'
import { EDUCATIONAL_ANALYSIS_PROMPT_VERSION } from './educational-analysis.prompt'
import {
  EducationalAnalysisRepository,
  type EducationalAnalysisIdentity,
  type PersistEducationalAnalysisInput,
  type PersistedEducationalAnalysisRecord,
  type StoreEducationalAnalysisResult,
} from './educational-analysis.repository'
import {
  EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY,
  EducationalAnalysisService,
} from './educational-analysis.service'
import {
  EDUCATIONAL_ANALYSIS_SCHEMA_VERSION,
  EFFORT_QUALITY,
  EFFORT_TYPE,
  LEARNING_EVIDENCE_STRENGTH,
  type EducationalAnalysisResult,
} from './educational-analysis.types'
import { TOPIC_RESOLUTION_OUTCOME } from './topic.types'

const goldenResult: EducationalAnalysisResult = {
  requestKind: MessageRequestKind.CODE_DIAGNOSIS,
  studentState: StudentState.DEBUGGING_ISSUE,
  effortEvidence: {
    present: true,
    quality: EFFORT_QUALITY.MEANINGFUL,
    type: EFFORT_TYPE.CODE_ATTEMPT,
    addressesPreviousTutorAction: true,
    isRepeated: false,
    evidenceMessageIds: ['message-22'],
  },
  learningEvidence: {
    present: false,
    strength: LEARNING_EVIDENCE_STRENGTH.NONE,
    evidenceMessageIds: [],
  },
  misconceptions: [
    {
      code: 'NON_SHRINKING_SEARCH_INTERVAL',
      description: 'The checked midpoint is retained in the next interval.',
      confidence: 0.88,
      evidenceMessageId: 'message-22',
    },
  ],
  topicRelation: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
  recommendedStrategy: TeachingStrategy.DEBUGGING_GUIDANCE,
  recommendedTechnique: TeachingTechnique.TRACE_EXECUTION,
  recommendedGuidanceLevel: 2,
  confidence: 0.9,
  evidenceReferences: ['message-22'],
}

describe('EducationalAnalysisService', () => {
  it('validates and persists the canonical binary-search golden result', async () => {
    const repository = new FakeEducationalAnalysisRepository()
    const model = new FakeAnalysisModelPort(goldenResult)
    const service = new EducationalAnalysisService(model, repository)
    const context = buildContext()

    const result = await service.analyze(context)

    expect(result).toMatchObject({
      success: true,
      reused: false,
      analysis: {
        turnId: 'turn-1',
        topicId: 'topic-1',
        studentMessageId: 'message-22',
        attempt: 1,
        result: goldenResult,
        provider: 'fake-provider',
        model: 'fake-model',
        promptVersion: EDUCATIONAL_ANALYSIS_PROMPT_VERSION,
        schemaVersion: EDUCATIONAL_ANALYSIS_SCHEMA_VERSION,
      },
    })
    expect(model.requests).toHaveLength(1)
    expect(model.requests[0]).toMatchObject({
      promptVersion: EDUCATIONAL_ANALYSIS_PROMPT_VERSION,
      responseSchemaName: 'EducationalAnalysisResult',
    })
    expect(model.requests[0]?.messages[1].content).toContain('"message-22"')
    expect(repository.storeInputs[0]).toMatchObject({
      turnId: 'turn-1',
      topicId: 'topic-1',
      studentMessageId: 'message-22',
      result: goldenResult,
      modelResponse: {
        provider: 'fake-provider',
        model: 'fake-model',
        promptVersion: EDUCATIONAL_ANALYSIS_PROMPT_VERSION,
      },
      forceReanalysis: false,
    })
    const stored = repository.records[0]
    expect(stored?.misconceptionRecords).toEqual([
      expect.objectContaining({
        code: 'NON_SHRINKING_SEARCH_INTERVAL',
        evidenceMessageId: 'message-22',
      }),
    ])
    expect(stored?.evidenceLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageId: 'message-22',
          kind: EducationalAnalysisEvidenceKind.TOP_LEVEL,
        }),
        expect.objectContaining({
          messageId: 'message-22',
          kind: EducationalAnalysisEvidenceKind.EFFORT,
        }),
      ]),
    )
  })

  it('reuses an existing accepted analysis without invoking the model', async () => {
    const repository = new FakeEducationalAnalysisRepository()
    repository.records.push(
      buildPersistedRecord({
        id: 'analysis-existing',
        attempt: 1,
        result: goldenResult,
      }),
    )
    const model = new FakeAnalysisModelPort(goldenResult)
    const service = new EducationalAnalysisService(model, repository)

    const result = await service.analyze(buildContext())

    expect(result).toMatchObject({
      success: true,
      reused: true,
      analysis: { id: 'analysis-existing' },
    })
    expect(model.requests).toHaveLength(0)
    expect(repository.storeInputs).toHaveLength(0)
  })

  it('creates a new immutable attempt for intentional re-analysis', async () => {
    const repository = new FakeEducationalAnalysisRepository()
    repository.records.push(
      buildPersistedRecord({
        id: 'analysis-existing',
        attempt: 1,
        result: goldenResult,
      }),
    )
    const model = new FakeAnalysisModelPort(goldenResult)
    const service = new EducationalAnalysisService(model, repository)

    const result = await service.analyze(buildContext(), {
      forceReanalysis: true,
    })

    expect(result).toMatchObject({
      success: true,
      reused: false,
      analysis: { attempt: 2 },
    })
    expect(model.requests).toHaveLength(1)
    expect(repository.records.map((record) => record.attempt)).toEqual([1, 2])
  })

  it('rejects off-context evidence without persisting analysis', async () => {
    const repository = new FakeEducationalAnalysisRepository()
    const model = new FakeAnalysisModelPort({
      ...goldenResult,
      evidenceReferences: ['message-999'],
    })
    const service = new EducationalAnalysisService(model, repository)

    const result = await service.analyze(buildContext())

    expect(result).toMatchObject({
      success: false,
      category: EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY.VALIDATION_FAILURE,
      errorCode: 'ANALYSIS_VALIDATION_FAILED',
    })
    expect(repository.storeInputs).toHaveLength(0)
    expect(repository.records).toHaveLength(0)
  })

  it('returns typed provider failure without persisting analysis', async () => {
    const repository = new FakeEducationalAnalysisRepository()
    const model = new FakeAnalysisModelPort(
      new AnalysisModelError(ANALYSIS_MODEL_ERROR_CODE.TIMEOUT),
    )
    const service = new EducationalAnalysisService(model, repository)

    const result = await service.analyze(buildContext())

    expect(result).toEqual({
      success: false,
      category: EDUCATIONAL_ANALYSIS_FAILURE_CATEGORY.PROVIDER_FAILURE,
      errorCode: ANALYSIS_MODEL_ERROR_CODE.TIMEOUT,
    })
    expect(repository.storeInputs).toHaveLength(0)
  })

  it('does not treat "give me the answer" as meaningful effort by itself', async () => {
    const repository = new FakeEducationalAnalysisRepository()
    const model = new FakeAnalysisModelPort(absentEffortResult())
    const service = new EducationalAnalysisService(model, repository)

    const result = await service.analyze(
      buildContext({ content: 'give me the answer' }),
    )

    expect(result).toMatchObject({
      success: true,
      analysis: {
        result: {
          effortEvidence: {
            present: false,
            quality: EFFORT_QUALITY.NONE,
            type: null,
          },
        },
      },
    })
  })

  it('does not treat "I understand" as learning evidence by itself', async () => {
    const repository = new FakeEducationalAnalysisRepository()
    const model = new FakeAnalysisModelPort(absentLearningResult())
    const service = new EducationalAnalysisService(model, repository)

    const result = await service.analyze(
      buildContext({ content: 'I understand' }),
    )

    expect(result).toMatchObject({
      success: true,
      analysis: {
        result: {
          learningEvidence: {
            present: false,
            strength: LEARNING_EVIDENCE_STRENGTH.NONE,
          },
        },
      },
    })
  })

  it('does not mutate the supplied context', async () => {
    const repository = new FakeEducationalAnalysisRepository()
    const model = new FakeAnalysisModelPort(goldenResult)
    const service = new EducationalAnalysisService(model, repository)
    const context = buildContext()
    const before = JSON.stringify(context)

    await service.analyze(context)

    expect(JSON.stringify(context)).toBe(before)
  })
})

class FakeAnalysisModelPort implements AnalysisModelPort {
  readonly requests: AnalysisModelRequest[] = []

  constructor(
    private readonly output: EducationalAnalysisResult | AnalysisModelError,
  ) {}

  analyze(request: AnalysisModelRequest): Promise<AnalysisModelResponse> {
    this.requests.push(request)
    if (this.output instanceof AnalysisModelError) {
      return Promise.reject(this.output)
    }

    return Promise.resolve({
      rawOutput: this.output,
      provider: 'fake-provider',
      model: 'fake-model',
      modelVersion: 'fake-model-version',
      promptVersion: request.promptVersion,
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 12,
    })
  }
}

class FakeEducationalAnalysisRepository extends EducationalAnalysisRepository {
  readonly records: PersistedEducationalAnalysisRecord[] = []
  readonly storeInputs: PersistEducationalAnalysisInput[] = []

  findLatestAccepted(
    input: EducationalAnalysisIdentity,
  ): Promise<PersistedEducationalAnalysisRecord | null> {
    return Promise.resolve(
      [...this.records]
        .filter(
          (record) =>
            record.turnId === input.turnId &&
            record.topicId === input.topicId &&
            record.studentMessageId === input.studentMessageId,
        )
        .sort((left, right) => right.attempt - left.attempt)[0] ?? null,
    )
  }

  storeAccepted(
    input: PersistEducationalAnalysisInput,
  ): Promise<StoreEducationalAnalysisResult> {
    this.storeInputs.push(input)

    if (!input.forceReanalysis) {
      const existing = this.records.find(
        (record) =>
          record.turnId === input.turnId &&
          record.topicId === input.topicId &&
          record.studentMessageId === input.studentMessageId,
      )
      if (existing !== undefined) {
        return Promise.resolve({ kind: 'reused', analysis: existing })
      }
    }

    const latestAttempt = Math.max(
      0,
      ...this.records
        .filter((record) => record.turnId === input.turnId)
        .map((record) => record.attempt),
    )
    const analysis = buildPersistedRecord({
      id: `analysis-${String(this.records.length + 1)}`,
      attempt: latestAttempt + 1,
      result: input.result,
      modelResponse: input.modelResponse,
    })
    this.records.push(analysis)

    return Promise.resolve({ kind: 'created', analysis })
  }
}

function buildContext(
  input: { content?: string } = {},
): AnalysisContextPackage {
  return {
    studentMessage: {
      id: 'message-22',
      sequence: 22,
      role: MessageRole.STUDENT,
      turnId: 'turn-1',
      topicId: 'topic-1',
      authorUserId: 'student-1',
      responseToMessageId: null,
      content:
        input.content ??
        'My binary search loops forever; I update low = mid and high = mid.',
      status: MessageStatus.COMPLETED,
      requestKind: null,
      guidanceLabel: null,
      hintLevel: null,
      createdAt: new Date('2026-08-04T10:00:00.000Z'),
      completedAt: new Date('2026-08-04T10:00:01.000Z'),
    },
    activeTopic: {
      id: 'topic-1',
      sessionId: 'session-1',
      courseId: 'course-1',
      problemId: null,
      conceptId: null,
      title: 'Binary search loop',
      topicType: TopicType.DEBUGGING_TASK,
      status: TopicStatus.ACTIVE,
      createdAt: new Date('2026-08-04T09:50:00.000Z'),
      updatedAt: new Date('2026-08-04T09:55:00.000Z'),
      resolvedAt: null,
    },
    topicState: null,
    selectedHistory: [
      {
        id: 'message-21',
        sequence: 21,
        role: MessageRole.ASSISTANT,
        turnId: 'turn-0',
        topicId: 'topic-1',
        authorUserId: null,
        responseToMessageId: 'message-20',
        content: 'What happens when low and high are adjacent?',
        status: MessageStatus.COMPLETED,
        requestKind: null,
        guidanceLabel: null,
        hintLevel: 1,
        createdAt: new Date('2026-08-04T09:59:00.000Z'),
        completedAt: new Date('2026-08-04T09:59:01.000Z'),
      },
    ],
    previousTutorQuestion: {
      source: 'selected_history',
      content: 'What happens when low and high are adjacent?',
      messageId: 'message-21',
      sequence: 21,
    },
    previousStudentAttempt: null,
    previousTeachingDecision: null,
    problemMetadata: null,
    conceptMetadata: null,
    courseMetadata: {
      id: 'course-1',
      code: 'CS101',
      title: 'Algorithms',
    },
    conversationLanguage: 'en',
    tokenBudget: {
      maxHistoryTokens: 1200,
      maxHistoryMessages: 24,
      approximateHistoryTokens: 80,
      tokenizer: 'char_approximation_v1',
    },
  }
}

function absentEffortResult(): EducationalAnalysisResult {
  return {
    ...goldenResult,
    effortEvidence: {
      present: false,
      quality: EFFORT_QUALITY.NONE,
      type: null,
      addressesPreviousTutorAction: false,
      isRepeated: false,
      evidenceMessageIds: [],
    },
    misconceptions: [],
    evidenceReferences: ['message-22'],
  }
}

function absentLearningResult(): EducationalAnalysisResult {
  return {
    ...goldenResult,
    learningEvidence: {
      present: false,
      strength: LEARNING_EVIDENCE_STRENGTH.NONE,
      evidenceMessageIds: [],
    },
    misconceptions: [],
    evidenceReferences: ['message-22'],
  }
}

function buildPersistedRecord(input: {
  id: string
  attempt: number
  result: EducationalAnalysisResult
  modelResponse?: AnalysisModelResponse
}): PersistedEducationalAnalysisRecord {
  return {
    id: input.id,
    turnId: 'turn-1',
    topicId: 'topic-1',
    studentMessageId: 'message-22',
    attempt: input.attempt,
    result: input.result,
    provider: input.modelResponse?.provider ?? 'fake-provider',
    model: input.modelResponse?.model ?? 'fake-model',
    modelVersion: input.modelResponse?.modelVersion ?? 'fake-model-version',
    promptVersion:
      input.modelResponse?.promptVersion ?? EDUCATIONAL_ANALYSIS_PROMPT_VERSION,
    schemaVersion: EDUCATIONAL_ANALYSIS_SCHEMA_VERSION,
    inputTokens: input.modelResponse?.inputTokens ?? 100,
    outputTokens: input.modelResponse?.outputTokens ?? 50,
    latencyMs: input.modelResponse?.latencyMs ?? 12,
    evidenceLinks: [
      ...input.result.evidenceReferences.map((messageId, ordinal) => ({
        id: `${input.id}-top-${String(ordinal)}`,
        messageId,
        kind: EducationalAnalysisEvidenceKind.TOP_LEVEL,
        ordinal,
      })),
      ...input.result.effortEvidence.evidenceMessageIds.map(
        (messageId, ordinal) => ({
          id: `${input.id}-effort-${String(ordinal)}`,
          messageId,
          kind: EducationalAnalysisEvidenceKind.EFFORT,
          ordinal,
        }),
      ),
    ],
    misconceptionRecords: input.result.misconceptions.map(
      (misconception, index) => ({
        id: `${input.id}-misconception-${String(index)}`,
        code: misconception.code,
        description: misconception.description,
        confidence: misconception.confidence,
        evidenceMessageId: misconception.evidenceMessageId,
      }),
    ),
    createdAt: new Date('2026-08-04T10:01:00.000Z'),
  }
}
