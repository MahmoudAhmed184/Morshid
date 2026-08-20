import {
  LearningStatus,
  MessageRequestKind,
  MisconceptionStatus,
  ReflectionMode,
  ResolutionEvidenceStrength,
  RevealPolicy,
  StudentActionPurpose,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
  TutoringAttemptStatus,
} from '../tutoring-values'
import { DEBUGGING_DIAGNOSIS_SCHEMA_VERSION } from './debugging-guidance/debugging-diagnosis.contract'
import { SocraticWorkflow } from './socratic-workflow'
import {
  EFFORT_QUALITY,
  LEARNING_EVIDENCE_STRENGTH,
} from './analysis/educational-analysis.types'
import { TOPIC_RESOLUTION_OUTCOME } from './topic/topic.types'

const attemptId = 'turn-1'
const courseId = 'course-1'
const sessionId = 'session-1'
const studentId = 'student-1'
const studentMessageId = 'student-message-1'
const assistantMessageId = 'assistant-message-1'
const topicId = 'topic-1'

describe('SocraticWorkflow classified responses', () => {
  it.each([
    [MessageRequestKind.UNSAFE, 'SOCRATIC_UNSAFE_REQUEST'],
    [MessageRequestKind.OFF_TOPIC, 'SOCRATIC_OFF_TOPIC_REQUEST'],
  ])(
    'terminates %s before teaching, retrieval, generation, or semantic guard',
    async (requestKind, errorCode) => {
      const teachingPolicyEngine = {
        findPreviousDecision: jest.fn(),
        selectDecision: jest.fn(),
      }
      const courseEvidence = {
        search: jest.fn(),
      }
      const responseApprovalService = {
        approve: jest.fn(),
      }
      const semanticGuard = {
        evaluate: jest.fn(),
      }
      const transitionAttempt = jest.fn().mockResolvedValue(true)
      const resolveTopic = jest.fn().mockResolvedValue({
        outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
        topicId,
        previousTopicId: null,
        confidence: 1,
        stableIdentitySource: 'PROBLEM_ID',
        reason: 'test topic',
      })
      const orchestrator = new SocraticWorkflow(
        {
          transitionAttempt,
        } as never,
        {
          resolveTopic,
        } as never,
        { getOrCreate: jest.fn().mockResolvedValue({ version: 1 }) } as never,
        {
          resolve: jest.fn().mockResolvedValue({
            protectTargetSolution: true,
            topicId,
            source: 'AUTHORITATIVE_TASK_METADATA',
            policyVersion: 'solution-protection.v1',
          }),
        } as never,
        {
          buildAnalysisContext: jest.fn().mockResolvedValue({}),
        } as never,
        {
          analyze: jest.fn().mockResolvedValue({
            success: true,
            analysis: {
              result: { requestKind },
            },
          }),
        } as never,
        teachingPolicyEngine as never,
        responseApprovalService as never,
        { build: jest.fn() },
        { resolve: jest.fn() } as never,
        courseEvidence,
        {
          detectStudentInput: jest.fn().mockReturnValue(null),
          detectRetrievedDocuments: jest.fn(),
          detectOutput: jest.fn(),
        },
        { detect: jest.fn() },
      )

      const result = await orchestrator.run({
        courseId,
        sessionId,
        studentId,
        attemptId,
        studentMessageId,
        assistantMessageId,
        studentMessageContent: 'classified request',
        explicitProtectedSolutionSignal: false,
        topicSelection: {
          problemId: 'problem-1',
          title: 'Problem topic',
        },
      })

      expect(result).toMatchObject({
        kind: 'completed',
        completion: {
          kind: 'classified',
          topicId,
          errorCode,
        },
      })
      expect(transitionAttempt).toHaveBeenCalledWith({
        courseId,
        sessionId,
        studentId,
        attemptId,
        expectedStatus: TutoringAttemptStatus.RECEIVED,
        nextStatus: TutoringAttemptStatus.ANALYZING,
        topicId,
      })
      expect(resolveTopic).toHaveBeenCalledWith({
        sessionId,
        courseId,
        topicId: undefined,
        problemId: 'problem-1',
        conceptId: undefined,
        title: 'Problem topic',
      })
      expect(teachingPolicyEngine.findPreviousDecision).not.toHaveBeenCalled()
      expect(teachingPolicyEngine.selectDecision).not.toHaveBeenCalled()
      expect(courseEvidence.search).not.toHaveBeenCalled()
      expect(responseApprovalService.approve).not.toHaveBeenCalled()
      expect(semanticGuard.evaluate).not.toHaveBeenCalled()
      expect(transitionAttempt).not.toHaveBeenCalledWith(
        attemptId,
        TutoringAttemptStatus.ANALYZING,
        TutoringAttemptStatus.DECIDING,
      )
    },
  )
})

describe('SocraticWorkflow debugging diagnosis admission', () => {
  it('preserves SOCRATIC_QUESTIONING and FOCUSED_QUESTION while model diagnosis flows through retrieval and approval', async () => {
    const transitionAttempt = jest.fn().mockResolvedValue(true)
    const debuggingDiagnosisService = {
      resolve: jest.fn().mockResolvedValue({
        success: true,
        reused: false,
        diagnosis: {
          id: '33333333-3333-4333-8333-333333333333',
          tutoringAttemptId: attemptId,
          schemaVersion: DEBUGGING_DIAGNOSIS_SCHEMA_VERSION,
          status: 'RESOLVED',
          source: 'MODEL',
          language: 'python',
          category: 'INITIALIZATION',
          confidence: 'MEDIUM',
          likelyDefect:
            'The running maximum starts at 0, so all-negative inputs never replace it.',
          location: {
            messageId: studentMessageId,
            lineStart: 2,
            lineEnd: 2,
            kind: 'CODE',
          },
          evidence: [
            {
              messageId: studentMessageId,
              lineStart: 2,
              lineEnd: 2,
              kind: 'CODE',
            },
            {
              messageId: studentMessageId,
              lineStart: null,
              lineEnd: null,
              kind: 'SYMPTOM',
            },
          ],
          underlyingConcept:
            'A running maximum must be initialized from the data or a valid lower bound.',
          requiresRuntimeEvidence: true,
          runtimeEvidenceNeeded: 'TRACE_VALUES',
          inspectionGoal: 'Trace the tracked maximum on an all-negative input.',
          fallbackReason: null,
          provider: 'fake-provider',
          model: 'fake-diagnosis-model',
          promptVersion: 'debugging-diagnosis.v1',
          inputTokens: 100,
          outputTokens: 80,
          infrastructureRetryCount: 0,
          createdAt: new Date('2026-08-16T00:00:00.000Z'),
        },
      }),
    }
    const decision = teachingDecision()
    const responseApprovalService = {
      approve: jest.fn().mockResolvedValue({
        success: true,
        approvedResponse: {
          message: 'Which value does the running maximum hold first?',
          responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
          usedCitationIds: ['retrieval.rank.1'],
          requiresStudentAction: true,
          studentAction: {
            type: TeachingTechnique.FOCUSED_QUESTION,
            description: 'Which value does the running maximum hold first?',
          },
          reflectionIncluded: false,
          source: 'VALIDATED_CANDIDATE',
          approvedCandidateAttempt: 1,
          safeFallbackUsed: false,
          approvalMetadata: {
            provider: 'deterministic',
            model: 'deterministic',
            promptVersion: 'tutor-generation.mvp.v9',
            inputTokens: 100,
            outputTokens: 50,
            validationPolicyVersion: 'response-validation.mvp.v1',
            structuralApproved: true,
            deterministicApproved: true,
            semanticApproved: true,
          },
        },
        safeFallbackReason: null,
        auditGraph: {
          outputRiskEvents: [],
        },
      }),
    }
    const courseEvidence = {
      search: jest.fn().mockResolvedValue({
        kind: 'ok',
        chunks: [{ id: 'retrieval.rank.1', content: 'Accumulator notes' }],
      }),
    }
    const orchestrator = new SocraticWorkflow(
      { transitionAttempt } as never,
      {
        resolveTopic: jest.fn().mockResolvedValue({
          outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
          topicId,
          previousTopicId: null,
          confidence: 1,
          stableIdentitySource: 'PROBLEM_ID',
          reason: 'test topic',
        }),
      } as never,
      { getOrCreate: jest.fn().mockResolvedValue(topicState()) } as never,
      {
        resolve: jest.fn().mockResolvedValue({
          protectTargetSolution: true,
          topicId,
          source: 'AUTHORITATIVE_TASK_METADATA',
          policyVersion: 'solution-protection.v1',
        }),
      } as never,
      {
        buildAnalysisContext: jest.fn().mockResolvedValue(analysisContext()),
      } as never,
      {
        analyze: jest.fn().mockResolvedValue({
          success: true,
          analysis: acceptedAnalysis(),
        }),
      } as never,
      {
        findPreviousDecision: jest.fn().mockResolvedValue(null),
        selectDecision: jest.fn().mockResolvedValue({
          success: true,
          decision,
        }),
      } as never,
      responseApprovalService as never,
      { build: jest.fn() },
      debuggingDiagnosisService as never,
      courseEvidence,
      {
        detectStudentInput: jest.fn().mockReturnValue(null),
        detectRetrievedDocuments: jest.fn().mockReturnValue(null),
        detectOutput: jest.fn().mockReturnValue(null),
      },
      { detect: jest.fn().mockReturnValue(null) },
    )

    const result = await orchestrator.run({
      courseId,
      sessionId,
      studentId,
      attemptId,
      studentMessageId,
      assistantMessageId,
      studentMessageContent: 'debug my largest function',
      explicitProtectedSolutionSignal: false,
      debuggingAdmission: {
        eligible: true,
        reason: 'ELIGIBLE_EXPLICIT_DEBUGGING_INTENT',
        rewriteRequested: false,
      },
      debuggingBoundary: {
        state: 'SUPPORTED',
        codeSource: 'PLAIN',
        lineCount: 5,
        reason: 'CODE_ACCEPTED',
      },
      topicSelection: {
        problemId: 'problem-1',
        title: 'Problem topic',
      },
    })

    expect(result).toMatchObject({
      kind: 'completed',
      completion: {
        kind: 'approved',
        guidanceLevel: 1,
      },
    })
    expect(decision).toMatchObject({
      strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
      primaryTechnique: TeachingTechnique.FOCUSED_QUESTION,
      studentActionPurpose: StudentActionPurpose.PRIMARY_TECHNIQUE,
      revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
      guidanceLevel: 1,
    })
    expect(debuggingDiagnosisService.resolve).toHaveBeenCalledWith({
      attemptId,
      studentMessageId,
      studentMessage: 'debug my largest function',
    })
    expect(courseEvidence.search).toHaveBeenCalledWith(
      courseId,
      expect.stringMatching(/running maximum|Trace/iu),
    )
    const expectedDebuggingGuidance: unknown = expect.objectContaining({
      likelyIssue:
        'The running maximum starts at 0, so all-negative inputs never replace it.',
      nextInspectionStep: 'Trace the tracked maximum on an all-negative input.',
    })
    expect(responseApprovalService.approve).toHaveBeenCalledWith(
      expect.objectContaining({
        teachingDecision: decision,
        debuggingGuidance: expectedDebuggingGuidance,
      }),
    )
  })
})

describe('SocraticWorkflow diagnosis-aware retrieval integration', () => {
  it('passes INITIALIZATION diagnosis concept to retrieval query instead of generic syntax', async () => {
    const debuggingDiagnosisService = initializationDiagnosisService()
    const courseEvidence = {
      search: jest.fn().mockResolvedValue({
        kind: 'ok',
        chunks: [{ id: 'retrieval.rank.1', content: 'Accumulator notes' }],
      }),
    }
    const orchestrator = buildOrchestrator({
      debuggingDiagnosisService,
      courseEvidence,
    })

    await orchestrator.run(debuggingWorkflowInput())

    expect(courseEvidence.search).toHaveBeenCalledWith(
      courseId,
      expect.stringContaining('running maximum'),
    )
    expect(courseEvidence.search).toHaveBeenCalledWith(
      courseId,
      expect.stringContaining('initialization issue'),
    )
    expect(courseEvidence.search).toHaveBeenCalledWith(
      courseId,
      expect.not.stringMatching(/syntax delimiter/iu),
    )
  })

  it('passes BOUNDARY diagnosis concept to retrieval for a non-initialization bug', async () => {
    const debuggingDiagnosisService = {
      resolve: jest.fn().mockResolvedValue({
        success: true,
        reused: false,
        diagnosis: boundaryDiagnosis(),
      }),
    }
    const courseEvidence = {
      search: jest.fn().mockResolvedValue({
        kind: 'ok',
        chunks: [{ id: 'retrieval.rank.1', content: 'Loop boundary notes' }],
      }),
    }
    const orchestrator = buildOrchestrator({
      debuggingDiagnosisService,
      courseEvidence,
    })

    await orchestrator.run(debuggingWorkflowInput())

    expect(courseEvidence.search).toHaveBeenCalledWith(
      courseId,
      expect.stringContaining('boundary issue'),
    )
    expect(courseEvidence.search).toHaveBeenCalledWith(
      courseId,
      expect.stringContaining('Loop boundaries'),
    )
    expect(courseEvidence.search).toHaveBeenCalledWith(
      courseId,
      expect.not.stringContaining('initialization'),
    )
  })

  it('passes uncertain diagnosis to retrieval without fabricating a category', async () => {
    const debuggingDiagnosisService = {
      resolve: jest.fn().mockResolvedValue({
        success: true,
        reused: false,
        diagnosis: uncertainDiagnosisRecord(),
      }),
    }
    const courseEvidence = {
      search: jest.fn().mockResolvedValue({
        kind: 'ok',
        chunks: [{ id: 'retrieval.rank.1', content: 'Tracing notes' }],
      }),
    }
    const orchestrator = buildOrchestrator({
      debuggingDiagnosisService,
      courseEvidence,
    })

    await orchestrator.run(debuggingWorkflowInput())

    expect(courseEvidence.search).toHaveBeenCalledWith(
      courseId,
      expect.not.stringContaining('initialization issue'),
    )
    expect(courseEvidence.search).toHaveBeenCalledWith(
      courseId,
      expect.stringContaining('Trace'),
    )
  })

  it('uses the same canonical diagnosis on replay without calling the diagnosis model again', async () => {
    const diagnosisResolve = jest.fn().mockResolvedValue({
      success: true,
      reused: true,
      diagnosis: initializationDiagnosisRecord(),
    })
    const courseEvidence = {
      search: jest.fn().mockResolvedValue({
        kind: 'ok',
        chunks: [{ id: 'retrieval.rank.1', content: 'Accumulator notes' }],
      }),
    }
    const orchestrator = buildOrchestrator({
      debuggingDiagnosisService: { resolve: diagnosisResolve },
      courseEvidence,
    })

    await orchestrator.run(debuggingWorkflowInput())

    expect(diagnosisResolve).toHaveBeenCalledTimes(1)
    expect(courseEvidence.search).toHaveBeenCalledWith(
      courseId,
      expect.stringContaining('running maximum'),
    )
  })

  it('does not expose provider/model provenance in the retrieval query', async () => {
    const courseEvidence = {
      search: jest.fn().mockResolvedValue({
        kind: 'ok',
        chunks: [{ id: 'retrieval.rank.1', content: 'Notes' }],
      }),
    }
    const orchestrator = buildOrchestrator({ courseEvidence })

    await orchestrator.run(debuggingWorkflowInput())

    expect(courseEvidence.search).toHaveBeenCalledWith(
      courseId,
      expect.not.stringContaining('fake-provider'),
    )
    expect(courseEvidence.search).toHaveBeenCalledWith(
      courseId,
      expect.not.stringContaining('fake-diagnosis-model'),
    )
  })

  it('passes canonical diagnosis through to generation context via debuggingGuidance', async () => {
    const responseApprovalService = approvalServiceMock()
    const orchestrator = buildOrchestrator({
      responseApprovalService,
    })

    await orchestrator.run(debuggingWorkflowInput())

    const expectedGuidance: unknown = expect.objectContaining({
      likelyIssue:
        'The running maximum starts at 0, so all-negative inputs never replace it.',
      concept:
        'A running maximum must be initialized from the data or a valid lower bound.',
      nextInspectionStep: 'Trace the tracked maximum on an all-negative input.',
    })
    expect(responseApprovalService.approve).toHaveBeenCalledWith(
      expect.objectContaining({
        debuggingGuidance: expectedGuidance,
      }),
    )
  })
})

function initializationDiagnosisRecord() {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    tutoringAttemptId: attemptId,
    schemaVersion: DEBUGGING_DIAGNOSIS_SCHEMA_VERSION,
    status: 'RESOLVED' as const,
    source: 'MODEL' as const,
    language: 'python',
    category: 'INITIALIZATION' as const,
    confidence: 'MEDIUM' as const,
    likelyDefect:
      'The running maximum starts at 0, so all-negative inputs never replace it.',
    location: {
      messageId: studentMessageId,
      lineStart: 2,
      lineEnd: 2,
      kind: 'CODE' as const,
    },
    evidence: [
      {
        messageId: studentMessageId,
        lineStart: 2,
        lineEnd: 2,
        kind: 'CODE' as const,
      },
      {
        messageId: studentMessageId,
        lineStart: null,
        lineEnd: null,
        kind: 'SYMPTOM' as const,
      },
    ],
    underlyingConcept:
      'A running maximum must be initialized from the data or a valid lower bound.',
    requiresRuntimeEvidence: true,
    runtimeEvidenceNeeded: 'TRACE_VALUES' as const,
    inspectionGoal: 'Trace the tracked maximum on an all-negative input.',
    fallbackReason: null,
    provider: 'fake-provider',
    model: 'fake-diagnosis-model',
    promptVersion: 'debugging-diagnosis.v1',
    inputTokens: 100,
    outputTokens: 80,
    infrastructureRetryCount: 0,
    createdAt: new Date('2026-08-16T00:00:00.000Z'),
  }
}

function boundaryDiagnosis() {
  return {
    ...initializationDiagnosisRecord(),
    category: 'BOUNDARY' as const,
    underlyingConcept:
      'Loop boundaries decide whether every collection element is visited.',
    likelyDefect:
      'The loop stops before the last item, so one item is never counted.',
    inspectionGoal: 'Trace which indexes the loop visits.',
  }
}

function uncertainDiagnosisRecord() {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    tutoringAttemptId: attemptId,
    schemaVersion: DEBUGGING_DIAGNOSIS_SCHEMA_VERSION,
    status: 'UNCERTAIN' as const,
    source: 'FALLBACK' as const,
    language: 'python',
    category: 'UNKNOWN' as const,
    confidence: 'LOW' as const,
    likelyDefect: null,
    location: {
      messageId: studentMessageId,
      lineStart: null,
      lineEnd: null,
      kind: 'SYMPTOM' as const,
    },
    evidence: [
      {
        messageId: studentMessageId,
        lineStart: null,
        lineEnd: null,
        kind: 'SYMPTOM' as const,
      },
    ],
    underlyingConcept: null,
    requiresRuntimeEvidence: true,
    runtimeEvidenceNeeded: 'TRACE_VALUES' as const,
    inspectionGoal:
      'Trace one input that shows the reported behavior and identify the first value that differs from the expected result.',
    fallbackReason: 'MODEL_UNAVAILABLE',
    provider: null,
    model: null,
    promptVersion: null,
    inputTokens: null,
    outputTokens: null,
    infrastructureRetryCount: 0,
    createdAt: new Date('2026-08-16T00:00:00.000Z'),
  }
}

function initializationDiagnosisService() {
  return {
    resolve: jest.fn().mockResolvedValue({
      success: true,
      reused: false,
      diagnosis: initializationDiagnosisRecord(),
    }),
  }
}

function approvalServiceMock() {
  return {
    approve: jest.fn().mockResolvedValue({
      success: true,
      approvedResponse: {
        message: 'Which value does the running maximum hold first?',
        responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
        usedCitationIds: ['retrieval.rank.1'],
        requiresStudentAction: true,
        studentAction: {
          type: TeachingTechnique.FOCUSED_QUESTION,
          description: 'Which value does the running maximum hold first?',
        },
        reflectionIncluded: false,
        source: 'VALIDATED_CANDIDATE',
        approvedCandidateAttempt: 1,
        safeFallbackUsed: false,
        approvalMetadata: {
          provider: 'deterministic',
          model: 'deterministic',
          promptVersion: 'tutor-generation.mvp.v9',
          inputTokens: 100,
          outputTokens: 50,
          validationPolicyVersion: 'response-validation.mvp.v1',
          structuralApproved: true,
          deterministicApproved: true,
          semanticApproved: true,
        },
      },
      safeFallbackReason: null,
      auditGraph: { outputRiskEvents: [] },
    }),
  }
}

function debuggingWorkflowInput() {
  return {
    courseId,
    sessionId,
    studentId,
    attemptId,
    studentMessageId,
    assistantMessageId,
    studentMessageContent: 'debug my largest function',
    explicitProtectedSolutionSignal: false,
    debuggingAdmission: {
      eligible: true,
      reason: 'ELIGIBLE_EXPLICIT_DEBUGGING_INTENT' as const,
      rewriteRequested: false,
    },
    debuggingBoundary: {
      state: 'SUPPORTED' as const,
      codeSource: 'PLAIN' as const,
      lineCount: 5,
      reason: 'CODE_ACCEPTED' as const,
    },
    topicSelection: {
      problemId: 'problem-1',
      title: 'Problem topic',
    },
  }
}

function buildOrchestrator(
  overrides: {
    debuggingDiagnosisService?: { resolve: jest.Mock }
    courseEvidence?: { search: jest.Mock }
    responseApprovalService?: { approve: jest.Mock }
  } = {},
) {
  const decision = teachingDecision()
  return new SocraticWorkflow(
    { transitionAttempt: jest.fn().mockResolvedValue(true) } as never,
    {
      resolveTopic: jest.fn().mockResolvedValue({
        outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
        topicId,
        previousTopicId: null,
        confidence: 1,
        stableIdentitySource: 'PROBLEM_ID',
        reason: 'test topic',
      }),
    } as never,
    { getOrCreate: jest.fn().mockResolvedValue(topicState()) } as never,
    {
      resolve: jest.fn().mockResolvedValue({
        protectTargetSolution: true,
        topicId,
        source: 'AUTHORITATIVE_TASK_METADATA',
        policyVersion: 'solution-protection.v1',
      }),
    } as never,
    {
      buildAnalysisContext: jest.fn().mockResolvedValue(analysisContext()),
    } as never,
    {
      analyze: jest.fn().mockResolvedValue({
        success: true,
        analysis: acceptedAnalysis(),
      }),
    } as never,
    {
      findPreviousDecision: jest.fn().mockResolvedValue(null),
      selectDecision: jest.fn().mockResolvedValue({
        success: true,
        decision,
      }),
    } as never,
    (overrides.responseApprovalService ?? approvalServiceMock()) as never,
    { build: jest.fn() },
    (overrides.debuggingDiagnosisService ??
      initializationDiagnosisService()) as never,
    overrides.courseEvidence ?? {
      search: jest.fn().mockResolvedValue({
        kind: 'ok',
        chunks: [{ id: 'retrieval.rank.1', content: 'Accumulator notes' }],
      }),
    },
    {
      detectStudentInput: jest.fn().mockReturnValue(null),
      detectRetrievedDocuments: jest.fn().mockReturnValue(null),
      detectOutput: jest.fn().mockReturnValue(null),
    },
    { detect: jest.fn().mockReturnValue(null) },
  )
}

function teachingDecision() {
  return {
    id: 'decision-1',
    attemptId,
    topicId,
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
    decisionReason: 'test decision',
    policyVersion: 'socratic-policy.mvp.v5',
    createdAt: new Date('2026-08-16T00:00:00.000Z'),
  }
}

function acceptedAnalysis() {
  return {
    id: 'analysis-1',
    attemptId,
    topicId,
    studentMessageId,
    analysisSource: 'MODEL',
    result: {
      requestKind: MessageRequestKind.CODE_DIAGNOSIS,
      studentState: StudentState.DEBUGGING_ISSUE,
      effortEvidence: {
        present: true,
        quality: EFFORT_QUALITY.MEANINGFUL,
        type: 'CODE_ATTEMPT',
        addressesPreviousTutorAction: false,
        isRepeated: false,
        evidenceMessageIds: [studentMessageId],
      },
      learningEvidence: {
        present: false,
        strength: LEARNING_EVIDENCE_STRENGTH.NONE,
        evidenceMessageIds: [],
      },
      misconceptions: [],
      topicRelation: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      recommendedStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
      recommendedTechnique: TeachingTechnique.FOCUSED_QUESTION,
      recommendedGuidanceLevel: 1,
      confidence: 0.9,
      evidenceReferences: [studentMessageId],
    },
  }
}

function topicState() {
  return {
    version: 1,
    attemptCount: 0,
    meaningfulAttemptCount: 0,
    misconceptionStatus: MisconceptionStatus.DISMISSED,
    learningStatus: LearningStatus.UNKNOWN,
    resolutionEvidenceStrength: ResolutionEvidenceStrength.NONE,
    resolved: false,
  }
}

function analysisContext() {
  return {
    activeTopic: {
      id: topicId,
      type: 'PROBLEM',
      title: 'Problem topic',
      problemId: 'problem-1',
      conceptId: null,
      courseId,
    },
  }
}
