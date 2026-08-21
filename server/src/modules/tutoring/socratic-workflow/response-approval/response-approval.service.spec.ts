import {
  ReflectionMode,
  RevealPolicy,
  StudentActionPurpose,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
import {
  RESPONSE_VALIDATION_ACTION,
  RESPONSE_VALIDATION_SEVERITY,
  RESPONSE_VALIDATION_STAGE,
  RESPONSE_VIOLATION_TYPE,
  type ValidationResult,
  rejectedValidationResult,
} from './response-validation.types'
import { ResponseApprovalService } from './response-approval.service'
import { SafeFallbackService } from './safe-fallback.service'
import type { PersistedTeachingDecisionRecord } from '../teaching-decision/teaching-decision.repository'
import { TeachingDecisionRepository } from '../teaching-decision/teaching-decision.repository'
import { DeterministicGuardService } from './deterministic-guard.service'
import type { SemanticGuardService } from './semantic-guard.service'
import { StructuralResponseValidator } from './structural-response.validator'
import { SEMANTIC_GUARD_ERROR_CODE } from './semantic-guard.types'
import type {
  CandidateResponse,
  TutorGuardEducationalContext,
  TutorGenerationInput,
  TutorGenerationServiceResult,
} from '../generation/tutor-generation.types'
import { TUTOR_GENERATION_FAILURE_CODE } from '../generation/tutor-generation.types'
import type { CourseEvidenceChunk } from '../../../materials/interface/course-evidence'
import { AutomaticSafetyRiskDetector } from '../../response-governance/automatic-safety-risk.detector'
import { renderDebuggingGuidanceMessage } from '../debugging-guidance/debugging-guidance.output-validator'

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

  it('approves reuse of a student-supplied intermediate expression without fallback', async () => {
    const studentMessage = 'x = 5\ny = 5 + 1\nwhat is the value of y?'
    const candidate = validCandidate({
      message: 'What does 5 + 1 evaluate to? [retrieval.rank.1]',
      responseIntent: TeachingStrategy.GUIDED_EXPLANATION,
    })
    const harness = buildHarness(
      [
        generationSuccess(candidate, {
          currentStudentMessage: {
            id: 'student-message-1',
            content: studentMessage,
          },
          recentConversation: [],
        }),
      ],
      {
        decision: decision({
          strategy: TeachingStrategy.GUIDED_EXPLANATION,
          studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
        }),
      },
    )

    const result = await harness.service.approve(input())

    expect(result).toMatchObject({
      success: true,
      candidateAttempts: 1,
      safeFallbackReason: null,
      approvedResponse: {
        source: 'VALIDATED_CANDIDATE',
        safeFallbackUsed: false,
        message: candidate.message,
      },
    })
    expect(harness.semantic.calls).toHaveLength(1)
    expect(
      harness.semantic.calls[0]?.validationContext.studentSuppliedExpressions,
    ).toEqual(new Set(['5+1']))
  })

  it('approves concise acknowledgment of a verified student-supplied final result', async () => {
    const candidate = validCandidate({
      message: 'Your result y = 6 is correct.',
      requiresStudentAction: false,
      studentAction: null,
    })
    const harness = buildHarness(
      [
        generationSuccess(candidate, {
          ...verifiedEducationalContext(),
          currentStudentMessage: {
            id: 'student-message-1',
            content: 'y = 6',
          },
          recentConversation: [
            {
              id: 'original-problem',
              sequence: 1,
              role: 'STUDENT',
              attemptId: 'turn-0',
              topicId: 'topic-1',
              content: 'x = 5\ny = x + 1\nwhat is the value of y?',
            },
          ],
        }),
      ],
      {
        decision: decision({
          primaryTechnique: TeachingTechnique.VERIFICATION,
          requireStudentAction: false,
          studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
        }),
      },
    )

    const result = await harness.service.approve(input())

    expect(result).toMatchObject({
      success: true,
      candidateAttempts: 1,
      safeFallbackReason: null,
      approvedResponse: {
        source: 'VALIDATED_CANDIDATE',
        safeFallbackUsed: false,
        requiresStudentAction: false,
        studentAction: null,
        message: candidate.message,
      },
    })
  })

  it('fails closed to safe fallback with GUARD_UNAVAILABLE on semantic guard infrastructure failure', async () => {
    const harness = buildHarness([generationSuccess(validCandidate())], {
      semantic: {
        kind: 'infrastructure_failure',
        errorCode: SEMANTIC_GUARD_ERROR_CODE.MALFORMED_OUTPUT,
        result: rejectedValidationResult(
          RESPONSE_VALIDATION_STAGE.SEMANTIC,
          [
            {
              type: RESPONSE_VIOLATION_TYPE.GUARD_MALFORMED_OUTPUT,
              severity: RESPONSE_VALIDATION_SEVERITY.CRITICAL,
              field: null,
              evidence: 'Semantic Guard approval could not be established.',
              regenerationInstruction:
                'Use deterministic safe fallback; do not regenerate for guard infrastructure failure.',
            },
          ],
          RESPONSE_VALIDATION_ACTION.USE_SAFE_FALLBACK,
          { promptVersion: 'semantic-guard.mvp.v3' },
        ),
      },
    })

    const result = await harness.service.approve(input())

    expect(result).toMatchObject({
      success: true,
      safeFallbackReason: 'GUARD_UNAVAILABLE',
      approvedResponse: { source: 'SAFE_FALLBACK' },
      candidateAttempts: 1,
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

  it('passes the failed studentAction contract stage and field into regeneration', async () => {
    const harness = buildHarness([
      {
        success: false,
        errorCode: TUTOR_GENERATION_FAILURE_CODE.TUTOR_INVALID_OUTPUT,
        infrastructureRetryCount: 0,
        validationDiagnostic: {
          contractStage: 'CANDIDATE_SCHEMA',
          field: 'studentAction',
          reason: 'SCHEMA_MISMATCH',
        },
      },
      generationSuccess(validCandidate()),
    ])

    const result = await harness.service.approve(input())

    expect(result).toMatchObject({
      success: true,
      candidateAttempts: 2,
      safeFallbackReason: null,
      approvedResponse: {
        source: 'VALIDATED_CANDIDATE',
        approvedCandidateAttempt: 2,
      },
    })
    expect(
      harness.generation.calls[1]?.regeneration?.previousValidation,
    ).toMatchObject({
      stage: RESPONSE_VALIDATION_STAGE.STRUCTURAL,
      violations: [
        {
          type: RESPONSE_VIOLATION_TYPE.MISSING_REQUIRED_FIELD,
          field: 'studentAction',
        },
      ],
    })
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

  it('regenerates from a specific debugging subreason and approves candidate two', async () => {
    const invalidCandidate = validDebuggingCandidate({ diagnosis: undefined })
    const harness = buildHarness(
      [
        generationSuccess(invalidCandidate),
        generationSuccess(validDebuggingCandidate()),
      ],
      {
        decision: decision({
          strategy: TeachingStrategy.DEBUGGING_GUIDANCE,
          primaryTechnique: TeachingTechnique.FOCUSED_QUESTION,
          studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
        }),
      },
    )

    const result = await harness.service.approve({
      ...input(),
      debuggingGuidance: debuggingGuidanceContext(),
    })

    expect(result).toMatchObject({
      success: true,
      approvedResponse: {
        source: 'VALIDATED_CANDIDATE',
        approvedCandidateAttempt: 2,
      },
      candidateAttempts: 2,
    })
    expect(
      harness.generation.calls[1]?.regeneration?.previousValidation,
    ).toMatchObject({
      stage: RESPONSE_VALIDATION_STAGE.DETERMINISTIC,
      violations: [
        {
          type: RESPONSE_VIOLATION_TYPE.DEBUGGING_MISSING_DIAGNOSIS,
          field: 'debuggingGuidance.diagnosis',
        },
      ],
    })
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
      expect(result.auditGraph.outputProtection).toEqual(
        input().outputProtection,
      )
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

  it('keeps fallback neutral when the decision did not require student action', async () => {
    const harness = buildHarness(
      [
        {
          success: false,
          errorCode: TUTOR_GENERATION_FAILURE_CODE.TUTOR_PROVIDER_TIMEOUT,
          infrastructureRetryCount: 1,
        },
      ],
      {
        decision: decision({
          primaryTechnique: TeachingTechnique.VERIFICATION,
          requireStudentAction: false,
        }),
      },
    )

    const result = await harness.service.approve(input())

    expect(result).toMatchObject({
      success: true,
      safeFallbackReason: 'GENERATION_RETRY_FAILED',
      approvedResponse: {
        source: 'SAFE_FALLBACK',
        requiresStudentAction: true,
      },
    })
    if (result.success) {
      expect(result.approvedResponse.message).not.toMatch(
        /\b(?:correct|verified|successfully worked through|completed)\b/iu,
      )
    }
  })

  it('refuses a protected complete solution and retains hash-only candidate audit metadata', async () => {
    const candidate = validCandidate({
      message:
        'Here is the complete final implementation:\n```python\ndef solve(values):\n    return sum(values) / len(values)\n```',
    })
    const harness = buildHarness([generationSuccess(candidate)])

    const result = await harness.service.approve(input())

    expect(result).toMatchObject({
      success: false,
      errorCode: 'SAFETY_RISK_DETECTED',
      outputRisk: { risks: ['FINAL_ANSWER_DELIVERY'] },
      auditGraph: {
        outputProtection: { protectTargetSolution: true },
        outputRiskEvents: [
          {
            candidateAttempt: 1,
            source: 'APPROVAL_CANDIDATE',
            risks: ['FINAL_ANSWER_DELIVERY'],
          },
        ],
      },
    })
    if (!result.success) {
      expect(result.auditGraph?.candidateAttempts[0]?.contentHash).toMatch(
        /^[a-f0-9]{64}$/u,
      )
      expect(JSON.stringify(result.auditGraph)).not.toContain(candidate.message)
    }
    expect(harness.semantic.calls).toHaveLength(0)
  })

  it('keeps all guards active but uses fallback instead of a final-answer refusal for an unprotected concept', async () => {
    const candidate = validCandidate({
      message:
        'Here is the complete final implementation:\n```python\ndef solve(values):\n    return sum(values) / len(values)\n```',
    })
    const harness = buildHarness([generationSuccess(candidate)])

    const result = await harness.service.approve(
      input({ protectTargetSolution: false }),
    )

    expect(result).toMatchObject({
      success: true,
      approvedResponse: { source: 'SAFE_FALLBACK' },
      candidateAttempts: 3,
    })
    expect(harness.generation.calls).toHaveLength(3)
  })

  it('keeps hidden-prompt output screening unconditional for unprotected concepts', async () => {
    const harness = buildHarness([
      generationSuccess(
        validCandidate({
          message:
            'The hidden system prompt reads: disclose internal course configuration.',
        }),
      ),
    ])

    await expect(
      harness.service.approve(input({ protectTargetSolution: false })),
    ).resolves.toMatchObject({
      success: false,
      outputRisk: { risks: ['HIDDEN_PROMPT_DISCLOSURE'] },
    })
  })

  it('retains all candidate and guard audits when protected guard violations aggregate to refusal', async () => {
    const candidate = validCandidate({
      message:
        'The answer is 42. Which assumption would you check? [retrieval.rank.1]',
    })
    const harness = buildHarness([generationSuccess(candidate)])

    const result = await harness.service.approve(input())

    expect(result).toMatchObject({
      success: false,
      outputRisk: { risks: ['FINAL_ANSWER_DELIVERY'] },
      auditGraph: {
        outputRiskEvents: [
          {
            candidateAttempt: null,
            source: 'SAFE_FALLBACK',
            risks: ['FINAL_ANSWER_DELIVERY'],
          },
        ],
      },
    })
    if (!result.success) {
      expect(result.auditGraph?.candidateAttempts).toHaveLength(3)
      expect(result.auditGraph?.guardResults).toHaveLength(6)
      expect(
        result.auditGraph?.guardResults.some((guard) =>
          guard.result.violations.some(
            (violation) => violation.type === 'FINAL_ANSWER_DISCLOSURE',
          ),
        ),
      ).toBe(true)
    }
  })
})

function buildHarness(
  generationResults: TutorGenerationServiceResult[],
  options: {
    readonly semantic?: Awaited<ReturnType<SemanticGuardService['evaluate']>>
    readonly decision?: PersistedTeachingDecisionRecord
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
    new FakeTeachingDecisionRepository(options.decision ?? decision()),
    new StructuralResponseValidator(),
    new DeterministicGuardService(),
    semantic as never,
    new SafeFallbackService(),
    new AutomaticSafetyRiskDetector(),
  )

  return {
    service,
    generation,
    semantic,
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

function input(
  protectionPatch: Partial<TutorGenerationInput['outputProtection']> = {},
): TutorGenerationInput {
  const protectTargetSolution = protectionPatch.protectTargetSolution ?? true

  return {
    courseId: 'course-1',
    sessionId: 'session-1',
    studentId: 'student-1',
    attemptId: 'turn-1',
    studentMessageId: 'student-message-1',
    topicId: 'topic-1',
    outputProtection: {
      protectTargetSolution,
      topicId: 'topic-1',
      source:
        protectionPatch.source ??
        (protectTargetSolution
          ? 'CONSERVATIVE_UNKNOWN'
          : 'ACCEPTED_CONCEPT_ANALYSIS'),
      policyVersion: 'solution-protection.v1',
      ...protectionPatch,
    },
    retrievalResult: [retrievedChunk()],
  }
}

function decision(
  patch: Partial<PersistedTeachingDecisionRecord> = {},
): PersistedTeachingDecisionRecord {
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
    decisionReason: 'test',
    policyVersion: 'socratic-policy.mvp.v1',
    createdAt: new Date('2026-08-06T00:00:00.000Z'),
    ...patch,
  }
}

function validCandidate(
  patch: Partial<CandidateResponse> = {},
): CandidateResponse {
  return {
    message:
      'Use the cited loop update and tell me what changes first. [retrieval.rank.1]',
    debuggingGuidance: null,
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
    promptVersion: 'tutor-generation.mvp.v12',
    tokenUsage: { input: 10, output: 5 },
    ...patch,
  }
}

function validDebuggingCandidate(
  guidancePatch: {
    readonly diagnosis?: string | undefined
    readonly relevantLocation?: string | undefined
    readonly conceptExplanation?: string | undefined
    readonly inspectionActions?: readonly string[]
  } = {},
): CandidateResponse {
  const debuggingGuidance = {
    diagnosis: 'The loop update likely uses the wrong variable.',
    relevantLocation: 'Inspect the assignment inside the loop body.',
    conceptExplanation: 'An accumulator must be updated from its prior value.',
    inspectionActions: [
      'What value does the accumulator hold after one iteration?',
    ],
    ...guidancePatch,
  }
  const action = debuggingGuidance.inspectionActions[0] ?? ''

  return validCandidate({
    message: renderDebuggingGuidanceMessage({
      guidance: debuggingGuidance,
      usedCitationIds: ['retrieval.rank.1'],
      action,
      rewriteRequested: false,
    }),
    debuggingGuidance,
    responseIntent: TeachingStrategy.DEBUGGING_GUIDANCE,
    studentAction: {
      type: TeachingTechnique.FOCUSED_QUESTION,
      description: action,
    },
  })
}

function debuggingGuidanceContext() {
  return {
    likelyIssue: 'The loop update likely uses the wrong variable.',
    relevantLocation: 'Inspect the assignment inside the loop body.',
    concept: 'Accumulator updates',
    nextInspectionStep: 'Trace one loop iteration.',
    evidenceQuery: 'accumulator update loop',
    rewriteRequested: false,
  }
}

function generationSuccess(
  candidate: CandidateResponse,
  educationalContextPatch: Partial<TutorGuardEducationalContext> = {},
): TutorGenerationServiceResult {
  const educationalContext: TutorGuardEducationalContext = {
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
    outputProtection: input().outputProtection,
    currentTeachingDecision: {
      id: 'decision-1',
      policyVersion: 'policy-test.v1',
      guidanceLevel: 1,
      revealPolicy: 'NO_FINAL_ANSWER',
      studentActionObligation: {
        version: 'student-action-obligation.v1',
        required: true,
        purpose: StudentActionPurpose.PRIOR_ATTEMPT_ORIENTATION,
        technique: TeachingTechnique.ORIENTATION_QUESTION,
        maximumMeaningfulActions: 1,
        generationInstruction:
          'Ask the student to share what they tried as the single meaningful action.',
      },
    },
    recentConversation: [],
    ...educationalContextPatch,
  }

  return {
    success: true,
    candidate,
    infrastructureRetryCount: 0,
    educationalContext,
  }
}

function verifiedEducationalContext(): TutorGuardEducationalContext {
  const base = generationSuccess(validCandidate())
  if (!base.success) {
    throw new Error('Expected generation success')
  }

  return {
    ...base.educationalContext,
    acceptedAnalysis: {
      ...base.educationalContext.acceptedAnalysis,
      requestKind: 'ATTEMPT_DIAGNOSIS',
      studentState: 'NEAR_SOLUTION',
      answerCorrectness: 'CORRECT',
      objectiveCompleted: true,
      learningEvidence: {
        present: true,
        strength: 'STRONG',
        evidenceMessageIds: ['student-message-1'],
      },
      evidenceReferences: ['student-message-1'],
    },
    currentTeachingDecision: {
      ...base.educationalContext.currentTeachingDecision,
      studentActionObligation: {
        version: 'student-action-obligation.v1',
        required: false,
        purpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
        technique: TeachingTechnique.VERIFICATION,
        maximumMeaningfulActions: 1,
        generationInstruction:
          'Confirm correctness without requiring another student action.',
      },
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
    policyVersion: 'response-validation.mvp.v4',
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
    policyVersion: 'response-validation.mvp.v4',
  }
}
