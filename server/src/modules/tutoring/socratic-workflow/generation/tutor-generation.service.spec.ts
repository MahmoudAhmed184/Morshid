import {
  MessageRole,
  MessageStatus,
  ReflectionMode,
  RevealPolicy,
  StudentActionPurpose,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
  TopicStatus,
  TopicType,
} from '../../tutoring-values'
import type { CourseEvidenceChunk } from '../../../materials/interface/course-evidence'
import type { AnalysisContextPackage } from '../analysis/analysis-context.types'
import type { AnalysisModelPort } from '../analysis/analysis-model.port'
import type { ContextManager } from '../analysis/context-manager.service'
import {
  EducationalAnalysisRepository,
  type PersistedEducationalAnalysisRecord,
} from '../analysis/educational-analysis.repository'
import {
  TeachingDecisionRepository,
  type PersistedTeachingDecisionRecord,
} from '../teaching-decision/teaching-decision.repository'
import { studentActionObligationFromDecision } from '../teaching-decision/student-action-obligation'
import { TutorGenerationService } from './tutor-generation.service'
import { TutorInfrastructureRetryPolicy } from './tutor-infrastructure-retry.policy'
import {
  TUTOR_MODEL_ERROR_CODE,
  TutorModelError,
  type TutorModelPort,
  type TutorModelRequest,
  type TutorGenerationInput,
} from './tutor-generation.types'

describe('TutorGenerationService', () => {
  it('returns one internal candidate with backend-owned metadata', async () => {
    const harness = buildHarness()

    const result = await harness.service.generate(defaultInput())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.candidate).toMatchObject({
        message: 'What should change before the next loop iteration?',
        provider: 'deterministic',
        model: 'deterministic-tutor',
        promptVersion: 'tutor-generation.mvp.v11',
        tokenUsage: { input: 15, output: 9 },
        usedCitationIds: ['retrieval.rank.1'],
      })
      expect(result.infrastructureRetryCount).toBe(0)
    }
    expect(harness.model.requests).toHaveLength(1)
    expect(harness.context.topicState).toEqual(buildTopicState())
  })

  it('uses the supplied retrieval result without performing retrieval itself', async () => {
    const harness = buildHarness()
    const result = await harness.service.generate(defaultInput())

    expect(result.success).toBe(true)
    expect(harness.model.requests).toHaveLength(1)
    expect(harness.model.requests[0]?.messages[1].content).toContain(
      'retrieval.rank.1',
    )
  })

  it('uses TutorModelPort without invoking an analysis model port', async () => {
    const harness = buildHarness()
    const analyze = jest.fn<
      ReturnType<AnalysisModelPort['analyze']>,
      Parameters<AnalysisModelPort['analyze']>
    >(() => Promise.reject(new Error('analysis model must not be invoked')))
    const _analysisModel: AnalysisModelPort = {
      analyze,
    }

    const result = await harness.service.generate(defaultInput())

    expect(result.success).toBe(true)
    expect(harness.model.requests).toHaveLength(1)
    expect(analyze).not.toHaveBeenCalled()
  })

  it.each([
    [
      'missing TeachingDecision',
      (harness: Harness) => {
        harness.decision.record = null
      },
      'MISSING_TEACHING_DECISION',
    ],
    [
      'missing accepted analysis',
      (harness: Harness) => {
        harness.analysis.record = null
      },
      'MISSING_ACCEPTED_ANALYSIS',
    ],
    [
      'context without matching turn',
      (harness: Harness) => {
        harness.context.studentMessage = {
          ...harness.context.studentMessage,
          attemptId: 'turn-other',
        }
      },
      'INVALID_GENERATION_CONTEXT',
    ],
    [
      'context from another course',
      (harness: Harness) => {
        harness.context.activeTopic = {
          ...harness.context.activeTopic,
          courseId: 'course-other',
        }
      },
      'INVALID_GENERATION_CONTEXT',
    ],
    [
      'cross-record relationship mismatch',
      (harness: Harness) => {
        harness.decision.record = {
          ...(harness.decision.record ?? buildDecision()),
          analysisId: 'analysis-other',
        }
      },
      'INVALID_GENERATION_CONTEXT',
    ],
  ])('fails safely for %s', async (_name, arrange, errorCode) => {
    const harness = buildHarness()
    arrange(harness)

    await expect(harness.service.generate(defaultInput())).resolves.toEqual({
      success: false,
      errorCode,
      infrastructureRetryCount: 0,
    })
    expect(harness.model.requests).toHaveLength(0)
  })

  it('rejects non-dense retrieval ranks before prompt construction', async () => {
    const harness = buildHarness()

    await expect(
      harness.service.generate({
        ...defaultInput(),
        retrievalResult: [
          retrievedChunk({ chunkId: 'chunk-a', rank: 1 }),
          retrievedChunk({ chunkId: 'chunk-b', rank: 1 }),
        ],
      }),
    ).resolves.toEqual({
      success: false,
      errorCode: 'RETRIEVAL_SCOPE_VIOLATION',
      infrastructureRetryCount: 0,
    })
    expect(harness.model.requests).toHaveLength(0)
  })

  it('rejects regeneration that changes the authoritative policy snapshot', async () => {
    const harness = buildHarness()
    const decision = buildDecision()
    const input = {
      ...defaultInput(),
      regeneration: {
        promptVersion: 'tutor-regeneration.mvp.v1',
        candidateAttempt: 2,
        previousValidation: {
          stage: 'SEMANTIC',
          violations: [],
          maximumSeverity: null,
        },
        authoritativePolicy: {
          teachingDecisionId: decision.id,
          policyVersion: decision.policyVersion,
          guidanceLevel: 2,
          revealPolicy: decision.revealPolicy,
          guardPolicy: decision.guardPolicy,
          studentActionObligation:
            studentActionObligationFromDecision(decision),
          outputProtection: defaultInput().outputProtection,
        },
      },
    } satisfies TutorGenerationInput

    await expect(harness.service.generate(input)).resolves.toEqual({
      success: false,
      errorCode: 'INVALID_GENERATION_CONTEXT',
      infrastructureRetryCount: 0,
    })
    expect(harness.model.requests).toHaveLength(0)
  })

  it('rejects regeneration that changes the immutable output protection snapshot', async () => {
    const harness = buildHarness()
    const decision = buildDecision()
    const original = defaultInput()
    const input = {
      ...original,
      regeneration: {
        promptVersion: 'tutor-regeneration.mvp.v1',
        candidateAttempt: 2,
        previousValidation: {
          stage: 'SEMANTIC',
          violations: [],
          maximumSeverity: null,
        },
        authoritativePolicy: {
          teachingDecisionId: decision.id,
          policyVersion: decision.policyVersion,
          guidanceLevel: decision.guidanceLevel,
          revealPolicy: decision.revealPolicy,
          guardPolicy: decision.guardPolicy,
          studentActionObligation:
            studentActionObligationFromDecision(decision),
          outputProtection: {
            ...original.outputProtection,
            protectTargetSolution: false,
            source: 'ACCEPTED_CONCEPT_ANALYSIS',
          },
        },
      },
    } satisfies TutorGenerationInput

    await expect(harness.service.generate(input)).resolves.toEqual({
      success: false,
      errorCode: 'INVALID_GENERATION_CONTEXT',
      infrastructureRetryCount: 0,
    })
    expect(harness.model.requests).toHaveLength(0)
  })

  it.each([
    ['malformed JSON', 'not-json', 'TUTOR_MALFORMED_OUTPUT'],
    [
      'structurally invalid output',
      { message: '', usedCitationIds: [] },
      'TUTOR_MALFORMED_OUTPUT',
    ],
    [
      'invented citation',
      validCandidate({ usedCitationIds: ['invented'] }),
      'TUTOR_INVALID_CITATION',
    ],
  ])(
    'maps %s to a typed generation failure',
    async (_name, rawOutput, errorCode) => {
      const harness = buildHarness()
      harness.model.rawOutput = rawOutput

      await expect(harness.service.generate(defaultInput())).resolves.toEqual({
        success: false,
        errorCode,
        infrastructureRetryCount: 0,
      })
      expect(harness.model.requests).toHaveLength(1)
    },
  )

  it.each([
    [TUTOR_MODEL_ERROR_CODE.TIMEOUT, 'TUTOR_PROVIDER_TIMEOUT', 1, 2],
    [TUTOR_MODEL_ERROR_CODE.RATE_LIMITED, 'TUTOR_PROVIDER_RATE_LIMIT', 0, 1],
    [
      TUTOR_MODEL_ERROR_CODE.PROVIDER_UNAVAILABLE,
      'TUTOR_PROVIDER_UNAVAILABLE',
      1,
      2,
    ],
    [
      TUTOR_MODEL_ERROR_CODE.TRANSPORT_FAILURE,
      'TUTOR_PROVIDER_TRANSPORT',
      1,
      2,
    ],
  ])(
    'maps provider %s safely after its bounded retry policy',
    async (providerCode, errorCode, infrastructureRetryCount, requestCount) => {
      const harness = buildHarness()
      harness.model.error = new TutorModelError(providerCode)

      await expect(harness.service.generate(defaultInput())).resolves.toEqual({
        success: false,
        errorCode,
        infrastructureRetryCount,
      })
      expect(harness.model.requests).toHaveLength(requestCount)
    },
  )

  it('reuses the same pedagogical request after a transient failure', async () => {
    const harness = buildHarness()
    harness.model.errorSequence = [
      new TutorModelError(TUTOR_MODEL_ERROR_CODE.TIMEOUT),
      null,
    ]

    const result = await harness.service.generate(defaultInput())

    expect(result).toMatchObject({
      success: true,
      infrastructureRetryCount: 1,
    })
    expect(harness.model.requests).toHaveLength(2)
    expect(harness.model.requests[1]).toEqual(harness.model.requests[0])
  })

  it('does not retry a non-retryable upstream HTTP status', async () => {
    const harness = buildHarness()
    harness.model.error = new TutorModelError(
      TUTOR_MODEL_ERROR_CODE.TRANSPORT_FAILURE,
      { status: 400, headers: new Headers({ 'retry-after-ms': '30_000' }) },
    )

    await expect(harness.service.generate(defaultInput())).resolves.toEqual({
      success: false,
      errorCode: 'TUTOR_PROVIDER_TRANSPORT',
      infrastructureRetryCount: 0,
    })
    expect(harness.model.requests).toHaveLength(1)
  })
})

interface Harness {
  readonly service: TutorGenerationService
  readonly context: AnalysisContextPackage
  readonly analysis: FakeEducationalAnalysisRepository
  readonly decision: FakeTeachingDecisionRepository
  readonly model: FakeTutorModel
}

function buildHarness(): Harness {
  const context = buildAnalysisContext()
  const analysis = new FakeEducationalAnalysisRepository(buildAnalysis())
  const decision = new FakeTeachingDecisionRepository(buildDecision())
  const model = new FakeTutorModel()
  const service = new TutorGenerationService(
    {
      buildAnalysisContext: () => Promise.resolve(context),
    } as Pick<ContextManager, 'buildAnalysisContext'> as ContextManager,
    analysis,
    decision,
    model,
    new TutorInfrastructureRetryPolicy(),
  )

  return { service, context, analysis, decision, model }
}

class FakeEducationalAnalysisRepository extends EducationalAnalysisRepository {
  constructor(public record: PersistedEducationalAnalysisRecord | null) {
    super()
  }

  findLatestAccepted(): Promise<PersistedEducationalAnalysisRecord | null> {
    return Promise.resolve(this.record)
  }

  storeAccepted(): never {
    throw new Error('TutorGenerationService must not persist analysis')
  }
}

class FakeTeachingDecisionRepository extends TeachingDecisionRepository {
  constructor(public record: PersistedTeachingDecisionRecord | null) {
    super()
  }

  findByTurnId(): Promise<PersistedTeachingDecisionRecord | null> {
    return Promise.resolve(this.record)
  }

  findLatestCompletedForSameTopicBeforeTurn(): Promise<PersistedTeachingDecisionRecord | null> {
    return Promise.resolve(null)
  }

  storeDecision(): never {
    throw new Error('TutorGenerationService must not modify decisions')
  }
}

class FakeTutorModel implements TutorModelPort {
  readonly requests: TutorModelRequest[] = []
  rawOutput: unknown = validCandidate()
  error: Error | null = null
  errorSequence: (Error | null | undefined)[] = []

  generate(request: TutorModelRequest) {
    this.requests.push(request)
    const scheduledError = this.errorSequence[this.requests.length - 1]
    if (scheduledError !== undefined && scheduledError !== null) {
      return Promise.reject(scheduledError)
    }
    if (this.error !== null) {
      return Promise.reject(this.error)
    }

    return Promise.resolve({
      rawOutput: this.rawOutput,
      provider: 'deterministic',
      model: 'deterministic-tutor',
      promptVersion: 'tutor-generation.mvp.v11' as const,
      inputTokens: 15,
      outputTokens: 9,
    })
  }
}

function defaultInput(): TutorGenerationInput {
  return {
    courseId: 'course-1',
    sessionId: 'session-1',
    studentId: 'student-1',
    attemptId: 'turn-1',
    studentMessageId: 'message-2',
    topicId: 'topic-1',
    outputProtection: {
      protectTargetSolution: true,
      topicId: 'topic-1',
      source: 'CONSERVATIVE_UNKNOWN' as const,
      policyVersion: 'solution-protection.v1',
    },
    retrievalResult: [retrievedChunk({ rank: 1 })],
  }
}

function buildAnalysisContext(): AnalysisContextPackage {
  const createdAt = new Date('2026-08-04T10:00:00.000Z')
  return {
    studentMessage: {
      id: 'message-2',
      sequence: 2,
      role: MessageRole.STUDENT,
      attemptId: 'turn-1',
      topicId: 'topic-1',
      authorUserId: null,
      responseToMessageId: null,
      content: 'Can you help me debug this loop?',
      status: MessageStatus.COMPLETED,
      requestKind: null,
      guidanceLabel: null,
      hintLevel: null,
      createdAt,
      completedAt: createdAt,
    },
    activeTopic: {
      id: 'topic-1',
      sessionId: 'session-1',
      courseId: 'course-1',
      problemId: null,
      conceptId: null,
      title: 'Loops',
      topicType: TopicType.DEBUGGING_TASK,
      status: TopicStatus.ACTIVE,
      solutionProtectionStatus: 'UNKNOWN',
      solutionProtectionSource: null,
      solutionProtectionPolicyVersion: null,
      solutionProtectionEstablishedAt: null,
      createdAt,
      updatedAt: createdAt,
      resolvedAt: null,
    },
    topicState: buildTopicState(),
    selectedHistory: [],
    previousTutorQuestion: null,
    previousStudentAttempt: null,
    previousTeachingDecision: null,
    problemMetadata: null,
    conceptMetadata: null,
    courseMetadata: {
      id: 'course-1',
      code: 'CS101',
      title: 'Python',
    },
    conversationLanguage: 'en',
    tokenBudget: {
      maxHistoryTokens: 1200,
      maxHistoryMessages: 24,
      approximateHistoryTokens: 0,
      tokenizer: 'char_approximation_v1',
    },
  }
}

function buildTopicState() {
  const updatedAt = new Date('2026-08-04T10:00:00.000Z')
  return {
    id: 'state-1',
    topicId: 'topic-1',
    version: 1,
    requestKind: null,
    studentState: StudentState.UNKNOWN,
    activeStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
    primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
    supportingTechnique: null,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    attemptCount: 0,
    meaningfulAttemptCount: 0,
    misconceptionStatus: null,
    learningStatus: 'UNKNOWN' as const,
    resolutionEvidenceStrength: 'NONE' as const,
    summary: null,
    lastTutorQuestion: null,
    lastStudentAction: null,
    resolved: false,
    updatedAt,
  }
}

function buildAnalysis(): PersistedEducationalAnalysisRecord {
  const createdAt = new Date('2026-08-04T10:00:00.000Z')
  return {
    id: 'analysis-1',
    attemptId: 'turn-1',
    topicId: 'topic-1',
    studentMessageId: 'message-2',
    attempt: 1,
    result: {
      requestKind: 'CODE_DIAGNOSIS',
      studentState: StudentState.DEBUGGING_ISSUE,
      effortEvidence: {
        present: false,
        quality: 'NONE',
        type: null,
        addressesPreviousTutorAction: false,
        isRepeated: false,
        evidenceMessageIds: [],
      },
      learningEvidence: {
        present: false,
        strength: 'NONE',
        evidenceMessageIds: [],
      },
      misconceptions: [],
      topicRelation: 'CONTINUE_CURRENT_TOPIC',
      recommendedStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
      recommendedTechnique: TeachingTechnique.ORIENTATION_QUESTION,
      recommendedGuidanceLevel: 1,
      confidence: 0.9,
      evidenceReferences: ['message-2'],
    },
    provider: 'deterministic',
    model: 'analysis',
    modelVersion: null,
    promptVersion: 'educational-analysis.v1',
    schemaVersion: 'educational-analysis.v1',
    inputTokens: null,
    outputTokens: null,
    latencyMs: null,
    analysisSource: 'model',
    fallbackReason: null,
    failureCategory: null,
    confidencePolicyVersion: null,
    infrastructureRetryCount: 0,
    evidenceLinks: [],
    misconceptionRecords: [],
    createdAt,
  }
}

function buildDecision(): PersistedTeachingDecisionRecord {
  return {
    id: 'decision-1',
    attemptId: 'turn-1',
    topicId: 'topic-1',
    analysisId: 'analysis-1',
    strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
    primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
    supportingTechnique: null,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    reflectionMode: ReflectionMode.NONE,
    requireStudentAction: true,
    studentActionPurpose: StudentActionPurpose.PRIOR_ATTEMPT_ORIENTATION,
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
  }
}

function retrievedChunk(
  patch: Partial<CourseEvidenceChunk> = {},
): CourseEvidenceChunk {
  return {
    chunkId: 'chunk-1',
    materialId: 'material-1',
    materialTitle: 'Loops.pdf',
    chunkIndex: 1,
    content: 'Loop conditions and updates determine termination.',
    rank: 1,
    similarityScore: 0.92,
    ...patch,
    embeddingModel: patch.embeddingModel ?? 'deterministic-embedding-v1',
  }
}

function validCandidate(patch: Record<string, unknown> = {}) {
  return {
    message: 'What should change before the next loop iteration?',
    debuggingGuidance: null,
    responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
    usedCitationIds: ['retrieval.rank.1'],
    requiresStudentAction: true,
    studentAction: {
      type: TeachingTechnique.ORIENTATION_QUESTION,
      description: 'Ask the learner to inspect the loop update.',
    },
    reflectionIncluded: false,
    selfReportedCompliance: {
      finalAnswerRevealed: false,
      completeSolutionRevealed: false,
    },
    ...patch,
  }
}
