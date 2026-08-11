import {
  LearningStatus,
  MessageRequestKind,
  ResolutionEvidenceStrength,
  ReflectionMode,
  RevealPolicy,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
  TutoringAttemptStatus,
} from '../../generated/prisma/client'
import {
  RESPONSE_VALIDATION_STAGE,
  type ValidationResult,
} from './response-validation.types'
import { ResponseApprovalService } from './response-approval.service'
import { SafeFallbackService } from './safe-fallback.service'
import type { PersistedTeachingDecisionRecord } from './teaching-decision.repository'
import { TeachingDecisionRepository } from './teaching-decision.repository'
import type { TopicStateTransitionAnalysis } from './topic-state-transition'
import type { TopicStateSnapshot } from './topic-state.types'
import { DeterministicGuardService } from './deterministic-guard.service'
import type { SemanticGuardService } from './semantic-guard.service'
import { StructuralResponseValidator } from './structural-response.validator'
import { SEMANTIC_GUARD_ERROR_CODE } from './semantic-guard.types'
import type {
  CandidateResponse,
  TutorGenerationInput,
  TutorGenerationServiceResult,
} from './tutor-generation.types'
import { TUTOR_GENERATION_FAILURE_CODE } from './tutor-generation.types'
import type { CourseEvidenceChunk } from '../materials/materials.public'
import { AutomaticSafetyRiskDetector } from '../output-policy/automatic-safety-risk.detector'

describe('ResponseApprovalService', () => {
  it('approves the initial candidate after all three stages', async () => {
    const harness = buildHarness([generationSuccess(validCandidate())])

    const result = await harness.service.approve(input())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.approvedResponse.source).toBe('VALIDATED_CANDIDATE')
      expect(result.approvedResponse.approvedCandidateAttempt).toBe(1)
      expect(result.validationResults.map((item) => item.stage)).toEqual([
        RESPONSE_VALIDATION_STAGE.STRUCTURAL,
        RESPONSE_VALIDATION_STAGE.DETERMINISTIC,
        RESPONSE_VALIDATION_STAGE.SEMANTIC,
      ])
    }
    expect(harness.generation.calls).toHaveLength(1)
    expect(harness.semantic.calls).toHaveLength(1)
    expect(harness.semantic.calls[0]?.educationalContext).toMatchObject({
      currentStudentMessage: { content: 'Inspect the loop state.' },
    })
  })

  it('regenerates once after first rejection and reruns the full pipeline', async () => {
    const harness = buildHarness([
      generationSuccess(validCandidate({ message: 'The answer is 42.' })),
      generationSuccess(validCandidate()),
    ])

    const result = await harness.service.approve(input())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.approvedResponse.source).toBe('VALIDATED_CANDIDATE')
      expect(result.approvedResponse.approvedCandidateAttempt).toBe(2)
      expect(result.candidateAttempts).toBe(2)
    }
    expect(harness.generation.calls).toHaveLength(2)
    expect(harness.generation.calls[1]?.regeneration).toMatchObject({
      promptVersion: 'tutor-regeneration.mvp.v1',
      candidateAttempt: 2,
      previousValidation: {
        stage: RESPONSE_VALIDATION_STAGE.DETERMINISTIC,
      },
    })
    expect(harness.semantic.calls).toHaveLength(1)
  })

  it('regenerates an ungrounded candidate when evidence is available', async () => {
    const harness = buildHarness([
      generationSuccess(validCandidate({ usedCitationIds: [] })),
      generationSuccess(validCandidate()),
    ])

    const result = await harness.service.approve(input())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.approvedResponse.source).toBe('VALIDATED_CANDIDATE')
      expect(result.approvedResponse.approvedCandidateAttempt).toBe(2)
    }
    expect(harness.generation.calls).toHaveLength(2)
    expect(harness.semantic.calls).toHaveLength(1)
  })

  it('uses fallback only after exactly three validation rejections', async () => {
    const harness = buildHarness([
      generationSuccess(validCandidate({ usedCitationIds: ['invalid-1'] })),
      generationSuccess(validCandidate({ usedCitationIds: ['invalid-2'] })),
      generationSuccess(validCandidate({ usedCitationIds: ['invalid-3'] })),
    ])

    const result = await harness.service.approve(input())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.approvedResponse.source).toBe('SAFE_FALLBACK')
      expect(result.approvedResponse.safeFallbackUsed).toBe(true)
      expect(result.approvedResponse.approvedCandidateAttempt).toBeNull()
      expect(result.candidateAttempts).toBe(3)
      expect(result.safeFallbackReason).toBe('VALIDATION_EXHAUSTED')
    }
    expect(harness.generation.calls).toHaveLength(3)
    expect(harness.semantic.calls).toHaveLength(0)
  })

  it('fails closed to fallback on guard infrastructure failure without retry', async () => {
    const harness = buildHarness([generationSuccess(validCandidate())], {
      semantic: {
        kind: 'infrastructure_failure',
        errorCode: SEMANTIC_GUARD_ERROR_CODE.PROVIDER_UNAVAILABLE,
        result: semanticFailureResult(),
      },
    })

    const result = await harness.service.approve(input())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.approvedResponse.source).toBe('SAFE_FALLBACK')
      expect(result.candidateAttempts).toBe(1)
    }
    expect(harness.generation.calls).toHaveLength(1)
    expect(harness.semantic.calls).toHaveLength(1)
  })

  it('does not call deterministic or semantic stages after structural generation rejection', async () => {
    const harness = buildHarness([
      {
        success: false,
        errorCode: TUTOR_GENERATION_FAILURE_CODE.TUTOR_INVALID_OUTPUT,
        infrastructureRetryCount: 0,
      },
      {
        success: false,
        errorCode: TUTOR_GENERATION_FAILURE_CODE.TUTOR_INVALID_OUTPUT,
        infrastructureRetryCount: 0,
      },
      {
        success: false,
        errorCode: TUTOR_GENERATION_FAILURE_CODE.TUTOR_INVALID_OUTPUT,
        infrastructureRetryCount: 0,
      },
    ])

    const result = await harness.service.approve(input())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.approvedResponse.source).toBe('SAFE_FALLBACK')
    }
    expect(harness.generation.calls).toHaveLength(3)
    expect(harness.semantic.calls).toHaveLength(0)
  })

  it('uses fallback when regeneration model call fails', async () => {
    const harness = buildHarness([
      {
        success: false,
        errorCode: TUTOR_GENERATION_FAILURE_CODE.TUTOR_INVALID_OUTPUT,
        infrastructureRetryCount: 0,
      },
      {
        success: false,
        errorCode: TUTOR_GENERATION_FAILURE_CODE.TUTOR_PROVIDER_TRANSPORT,
        infrastructureRetryCount: 1,
      },
    ])

    const result = await harness.service.approve(input())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.approvedResponse.source).toBe('SAFE_FALLBACK')
      expect(result.candidateAttempts).toBe(2)
    }
    expect(harness.generation.calls).toHaveLength(2)
  })

  it('persists the canonical lifecycle while approving the third candidate', async () => {
    const harness = buildHarness([
      generationSuccess(validCandidate({ message: 'The answer is 42.' })),
      generationSuccess(validCandidate({ message: 'Final answer: 43.' })),
      generationSuccess(validCandidate()),
    ])

    const result = await harness.service.approveAndPersist({
      ...input(),
      assistantMessageId: 'assistant-message-1',
      topicState: topicState(),
      analysis: analysisForState(),
    })

    expect(result.success).toBe(true)
    expect(harness.transitions).toEqual([
      [TutoringAttemptStatus.GENERATING, TutoringAttemptStatus.VALIDATING],
      [TutoringAttemptStatus.VALIDATING, TutoringAttemptStatus.REGENERATING],
      [TutoringAttemptStatus.REGENERATING, TutoringAttemptStatus.GENERATING],
      [TutoringAttemptStatus.GENERATING, TutoringAttemptStatus.VALIDATING],
      [TutoringAttemptStatus.VALIDATING, TutoringAttemptStatus.REGENERATING],
      [TutoringAttemptStatus.REGENERATING, TutoringAttemptStatus.GENERATING],
      [TutoringAttemptStatus.GENERATING, TutoringAttemptStatus.VALIDATING],
    ])
    expect(harness.completeApprovedResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedTurnStatus: TutoringAttemptStatus.VALIDATING,
        safeFallbackReason: null,
      }),
    )
  })
})

function buildHarness(
  generationResults: TutorGenerationServiceResult[],
  options: {
    readonly semantic?: Awaited<ReturnType<SemanticGuardService['evaluate']>>
  } = {},
) {
  const generation = new FakeGenerationService(generationResults)
  const semantic = new FakeSemanticGuardService(
    options.semantic ?? {
      kind: 'validated',
      result: approvedSemanticResult(),
    },
  )
  const transitions: [TutoringAttemptStatus, TutoringAttemptStatus][] = []
  const completeApprovedResponse = jest.fn(() =>
    Promise.resolve({ kind: 'ok', turn: {} }),
  )
  const service = new ResponseApprovalService(
    generation as never,
    new FakeTeachingDecisionRepository(decision()),
    new StructuralResponseValidator(),
    new DeterministicGuardService(),
    semantic as never,
    new SafeFallbackService(),
    { completeApprovedResponse } as never,
    {
      transitionStatus: (
        _attemptId: string,
        expectedStatus: TutoringAttemptStatus,
        nextStatus: TutoringAttemptStatus,
      ) => {
        transitions.push([expectedStatus, nextStatus])
        return Promise.resolve({})
      },
    } as never,
    new AutomaticSafetyRiskDetector(),
  )

  return {
    service,
    generation,
    semantic,
    transitions,
    completeApprovedResponse,
  }
}

class FakeGenerationService {
  readonly calls: TutorGenerationInput[] = []

  constructor(private readonly results: TutorGenerationServiceResult[]) {}

  generate(input: TutorGenerationInput) {
    this.calls.push(input)
    return Promise.resolve(
      this.results[this.calls.length - 1] ??
        this.results[this.results.length - 1],
    )
  }
}

class FakeSemanticGuardService {
  readonly calls: Parameters<SemanticGuardService['evaluate']>[0][] = []

  constructor(
    private readonly result: Awaited<
      ReturnType<SemanticGuardService['evaluate']>
    >,
  ) {}

  evaluate(input: Parameters<SemanticGuardService['evaluate']>[0]) {
    this.calls.push(input)
    return Promise.resolve(this.result)
  }
}

class FakeTeachingDecisionRepository extends TeachingDecisionRepository {
  constructor(private readonly record: PersistedTeachingDecisionRecord | null) {
    super()
  }

  findByTurnId() {
    return Promise.resolve(this.record)
  }

  findLatestCompletedForSameTopicBeforeTurn() {
    return Promise.resolve(null)
  }

  storeDecision(): never {
    throw new Error('ResponseApprovalService must not store decisions')
  }
}

function input(): TutorGenerationInput {
  return {
    courseId: 'course-1',
    sessionId: 'session-1',
    studentId: 'student-1',
    attemptId: 'turn-1',
    studentMessageId: 'student-message-1',
    topicId: 'topic-1',
    retrievalResult: [retrievedChunk()],
  }
}

function topicState(): TopicStateSnapshot {
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
    learningStatus: LearningStatus.UNKNOWN,
    resolutionEvidenceStrength: ResolutionEvidenceStrength.NONE,
    summary: null,
    lastTutorQuestion: null,
    lastStudentAction: null,
    resolved: false,
    updatedAt: new Date('2026-08-06T00:00:00.000Z'),
  }
}

function analysisForState(): TopicStateTransitionAnalysis {
  return {
    studentMessageId: 'student-message-1',
    result: {
      requestKind: MessageRequestKind.CONCEPTUAL,
      studentState: StudentState.PARTIAL_UNDERSTANDING,
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
      evidenceReferences: ['student-message-1'],
    },
  }
}

function decision(): PersistedTeachingDecisionRecord {
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
    policyVersion: 'socratic-policy.mvp.v1',
    createdAt: new Date('2026-08-06T00:00:00.000Z'),
  }
}

function validCandidate(
  patch: Partial<CandidateResponse> = {},
): CandidateResponse {
  return {
    message:
      'Use the cited loop update and tell me what changes first. [retrieval.rank.1]',
    responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
    usedCitationIds: ['retrieval.rank.1'],
    requiresStudentAction: true,
    studentAction: {
      type: TeachingTechnique.ORIENTATION_QUESTION,
      description: 'Identify the first value that changes before continuing.',
    },
    reflectionIncluded: false,
    selfReportedCompliance: {
      finalAnswerRevealed: false,
      completeSolutionRevealed: false,
    },
    provider: 'deterministic',
    model: 'deterministic-tutor',
    promptVersion: 'tutor-generation.mvp.v4',
    tokenUsage: { input: 10, output: 5 },
    ...patch,
  }
}

function generationSuccess(
  candidate: CandidateResponse,
): TutorGenerationServiceResult {
  return {
    success: true,
    candidate,
    infrastructureRetryCount: 0,
    educationalContext: {
      currentStudentMessage: {
        id: 'message-1',
        content: 'Inspect the loop state.',
      },
      acceptedAnalysis: {
        id: 'analysis-1',
        requestKind: 'CONCEPTUAL',
        studentState: 'PARTIAL_UNDERSTANDING',
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
        evidenceReferences: ['message-1'],
        confidence: 0.9,
        analysisSource: 'model',
        promptVersion: 'analysis-test.v1',
        schemaVersion: 'analysis-schema.v1',
      },
      topicState: null,
      previousTeachingDecision: null,
      currentTeachingDecision: {
        id: 'decision-1',
        policyVersion: 'policy-test.v1',
        guidanceLevel: 1,
        revealPolicy: 'NO_FINAL_ANSWER',
      },
      recentConversation: [],
    },
  }
}

function retrievedChunk(): CourseEvidenceChunk {
  return {
    chunkId: 'chunk-1',
    materialId: 'material-1',
    materialTitle: 'Loops',
    chunkIndex: 0,
    content: 'Loop variables change during iteration.',
    rank: 1,
    similarityScore: 0.9,
    embeddingModel: 'deterministic-embedding-v1',
  }
}

function approvedSemanticResult(): ValidationResult {
  return {
    stage: RESPONSE_VALIDATION_STAGE.SEMANTIC,
    approved: true,
    violations: [],
    maximumSeverity: null,
    recommendedAction: 'APPROVE',
    provider: 'deterministic',
    model: 'semantic-guard',
    promptVersion: 'semantic-guard.mvp.v3',
    policyVersion: 'response-validation.mvp.v1',
  }
}

function semanticFailureResult(): ValidationResult {
  return {
    stage: RESPONSE_VALIDATION_STAGE.SEMANTIC,
    approved: false,
    violations: [],
    maximumSeverity: null,
    recommendedAction: 'USE_SAFE_FALLBACK',
    provider: null,
    model: null,
    promptVersion: 'semantic-guard.mvp.v3',
    policyVersion: 'response-validation.mvp.v1',
  }
}
