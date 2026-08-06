import {
  ReflectionMode,
  RevealPolicy,
  TeachingStrategy,
  TeachingTechnique,
} from '../../generated/prisma/client'
import {
  RESPONSE_VALIDATION_STAGE,
  type ValidationResult,
} from './response-validation.types'
import { ResponseApprovalService } from './response-approval.service'
import { SafeFallbackService } from './safe-fallback.service'
import type { PersistedTeachingDecisionRecord } from './teaching-decision.repository'
import { TeachingDecisionRepository } from './teaching-decision.repository'
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
import type { RetrievedChunk } from '../retrieval/retrieval.service'

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

  it('uses fallback after two validation rejections and does not request a third candidate', async () => {
    const harness = buildHarness([
      generationSuccess(validCandidate({ message: 'The answer is 42.' })),
      generationSuccess(validCandidate({ message: 'Final answer: 43.' })),
      generationSuccess(validCandidate()),
    ])

    const result = await harness.service.approve(input())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.approvedResponse.source).toBe('SAFE_FALLBACK')
      expect(result.approvedResponse.safeFallbackUsed).toBe(true)
      expect(result.approvedResponse.approvedCandidateAttempt).toBeNull()
      expect(result.candidateAttempts).toBe(2)
    }
    expect(harness.generation.calls).toHaveLength(2)
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
      },
      {
        success: false,
        errorCode: TUTOR_GENERATION_FAILURE_CODE.TUTOR_INVALID_OUTPUT,
      },
    ])

    const result = await harness.service.approve(input())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.approvedResponse.source).toBe('SAFE_FALLBACK')
    }
    expect(harness.generation.calls).toHaveLength(2)
    expect(harness.semantic.calls).toHaveLength(0)
  })

  it('uses fallback when regeneration model call fails', async () => {
    const harness = buildHarness([
      {
        success: false,
        errorCode: TUTOR_GENERATION_FAILURE_CODE.TUTOR_INVALID_OUTPUT,
      },
      {
        success: false,
        errorCode: TUTOR_GENERATION_FAILURE_CODE.TUTOR_PROVIDER_TRANSPORT,
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
  const service = new ResponseApprovalService(
    generation as never,
    new FakeTeachingDecisionRepository(decision()),
    new StructuralResponseValidator(),
    new DeterministicGuardService(),
    semantic as never,
    new SafeFallbackService(),
    { completeApprovedResponse: jest.fn() } as never,
  )

  return { service, generation, semantic }
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

  storeDecision(): never {
    throw new Error('ResponseApprovalService must not store decisions')
  }
}

function input(): TutorGenerationInput {
  return {
    courseId: 'course-1',
    sessionId: 'session-1',
    studentId: 'student-1',
    turnId: 'turn-1',
    studentMessageId: 'student-message-1',
    topicId: 'topic-1',
    retrievalResult: [retrievedChunk()],
  }
}

function decision(): PersistedTeachingDecisionRecord {
  return {
    id: 'decision-1',
    turnId: 'turn-1',
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
    promptVersion: 'tutor-generation.mvp.v1',
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
  }
}

function retrievedChunk(): RetrievedChunk {
  return {
    chunkId: 'chunk-1',
    materialId: 'material-1',
    materialTitle: 'Loops',
    chunkIndex: 0,
    content: 'Loop variables change during iteration.',
    rank: 1,
    similarityScore: 0.9,
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
    promptVersion: 'semantic-guard.mvp.v1',
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
    promptVersion: 'semantic-guard.mvp.v1',
    policyVersion: 'response-validation.mvp.v1',
  }
}
