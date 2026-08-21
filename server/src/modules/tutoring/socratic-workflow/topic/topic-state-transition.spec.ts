import {
  LearningStatus,
  MessageRequestKind,
  MisconceptionStatus,
  ResolutionEvidenceStrength,
  RevealPolicy,
  StudentActionPurpose,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
} from '../../tutoring-values'
import {
  ANSWER_CORRECTNESS,
  EDUCATIONAL_ANALYSIS_SOURCE,
  LEARNING_EVIDENCE_STRENGTH,
  type EducationalAnalysisResult,
} from '../analysis/educational-analysis.types'
import type { PersistedTeachingDecisionRecord } from '../teaching-decision/teaching-decision.repository'
import type { ApprovedResponse } from '../response-approval/response-validation.types'
import {
  buildClassifiedTopicStateTransition,
  buildCompletedTopicStateTransition,
} from './topic-state-transition'
import type { TopicStateSnapshot } from './topic-state.types'

describe('TopicState transition builder', () => {
  it('projects accepted analysis and decision into one bounded state patch', () => {
    const transition = buildCompletedTopicStateTransition({
      topicState: topicState(),
      analysis: {
        analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        studentMessageId: 'student-message-2',
        result: analysisResult(),
      },
      decision: decision(),
      approvedResponse: approvedResponse(),
    })

    expect(transition).toEqual({
      expectedVersion: 4,
      patch: {
        requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
        studentState: StudentState.DEBUGGING_ISSUE,
        activeStrategy: TeachingStrategy.DEBUGGING_GUIDANCE,
        primaryTechnique: TeachingTechnique.TRACE_EXECUTION,
        supportingTechnique: TeachingTechnique.VERIFICATION,
        guidanceLevel: 2,
        revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
        attemptCount: 3,
        meaningfulAttemptCount: 2,
        misconceptionStatus: 'ACTIVE',
        learningStatus: LearningStatus.DEMONSTRATED,
        resolutionEvidenceStrength: ResolutionEvidenceStrength.MODERATE,
        summary: 'Misconception LOOP_UPDATE: The update is skipped.',
        lastTutorQuestion: 'Inspect one loop update before moving on.',
        lastStudentAction: 'Student effort: meaningful code attempt.',
        resolved: false,
      },
    })
  })

  it('persists no tutor question when a completed objective has no student action', () => {
    const transition = buildCompletedTopicStateTransition({
      topicState: topicState(),
      analysis: {
        analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        studentMessageId: 'student-message-2',
        result: {
          ...analysisResult(),
          studentState: StudentState.NEAR_SOLUTION,
          answerCorrectness: ANSWER_CORRECTNESS.CORRECT,
          objectiveCompleted: true,
        },
      },
      decision: { ...decision(), requireStudentAction: false },
      approvedResponse: {
        ...approvedResponse(),
        message: 'Your reasoning correctly completes this objective.',
        requiresStudentAction: false,
        studentAction: null,
      },
    })

    expect(transition.patch.lastTutorQuestion).toBeNull()
  })

  it('advances classified turns through the same versioned state contract', () => {
    expect(
      buildClassifiedTopicStateTransition({
        topicState: topicState(),
        requestKind: MessageRequestKind.OFF_TOPIC,
      }),
    ).toEqual({
      expectedVersion: 4,
      patch: {
        requestKind: MessageRequestKind.OFF_TOPIC,
        summary: 'Request classified as OFF_TOPIC.',
        lastTutorQuestion: null,
        lastStudentAction: null,
      },
    })
  })

  it('marks an active misconception corrected after strong supported recovery', () => {
    const result = analysisResult()
    const transition = buildCompletedTopicStateTransition({
      topicState: topicState({
        misconceptionStatus: MisconceptionStatus.ACTIVE,
      }),
      analysis: {
        analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        studentMessageId: 'student-message-2',
        result: {
          ...result,
          requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
          studentState: StudentState.NEAR_SOLUTION,
          learningEvidence: {
            present: true,
            strength: LEARNING_EVIDENCE_STRENGTH.STRONG,
            evidenceMessageIds: ['student-message-2'],
          },
          answerCorrectness: ANSWER_CORRECTNESS.CORRECT,
          misconceptionRecoveryVerified: true,
          misconceptions: [],
        },
      },
      decision: decision(),
      approvedResponse: approvedResponse(),
    })

    expect(transition.patch.misconceptionStatus).toBe(
      MisconceptionStatus.CORRECTED,
    )
  })

  it('does not persist a verified learning status from strong evidence attached to a wrong answer', () => {
    const result = analysisResult()
    const transition = buildCompletedTopicStateTransition({
      topicState: topicState({ learningStatus: LearningStatus.VERIFIED }),
      analysis: {
        analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        studentMessageId: 'student-message-2',
        result: {
          ...result,
          answerCorrectness: ANSWER_CORRECTNESS.INCORRECT,
          learningEvidence: {
            present: true,
            strength: LEARNING_EVIDENCE_STRENGTH.STRONG,
            evidenceMessageIds: ['student-message-2'],
          },
          misconceptions: [],
        },
      },
      decision: decision(),
      approvedResponse: approvedResponse(),
    })

    expect(transition.patch).toMatchObject({
      learningStatus: LearningStatus.IN_PROGRESS,
      resolutionEvidenceStrength: ResolutionEvidenceStrength.NONE,
      summary: 'Current answer assessment: incorrect.',
    })
  })

  it('keeps an active misconception for an unsupported self-report', () => {
    const result = analysisResult()
    const transition = buildCompletedTopicStateTransition({
      topicState: topicState({
        misconceptionStatus: MisconceptionStatus.ACTIVE,
      }),
      analysis: {
        analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        studentMessageId: 'student-message-2',
        result: {
          ...result,
          requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
          studentState: StudentState.NEAR_SOLUTION,
          learningEvidence: {
            present: false,
            strength: LEARNING_EVIDENCE_STRENGTH.NONE,
            evidenceMessageIds: [],
          },
          misconceptions: [],
        },
      },
      decision: decision(),
      approvedResponse: approvedResponse(),
    })

    expect(transition.patch.misconceptionStatus).toBe(
      MisconceptionStatus.ACTIVE,
    )
  })

  it('keeps an active misconception for another incorrect attempt', () => {
    const transition = buildCompletedTopicStateTransition({
      topicState: topicState({
        misconceptionStatus: MisconceptionStatus.ACTIVE,
      }),
      analysis: {
        analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
        studentMessageId: 'student-message-2',
        result: analysisResult(),
      },
      decision: decision(),
      approvedResponse: approvedResponse(),
    })

    expect(transition.patch.misconceptionStatus).toBe(
      MisconceptionStatus.ACTIVE,
    )
  })
})

function topicState(
  input: Partial<TopicStateSnapshot> = {},
): TopicStateSnapshot {
  return {
    id: 'topic-state-1',
    topicId: 'topic-1',
    version: 4,
    requestKind: MessageRequestKind.CONCEPTUAL,
    studentState: StudentState.PARTIAL_UNDERSTANDING,
    activeStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
    primaryTechnique: TeachingTechnique.ORIENTATION_QUESTION,
    supportingTechnique: null,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    attemptCount: 2,
    meaningfulAttemptCount: 1,
    misconceptionStatus: null,
    learningStatus: LearningStatus.IN_PROGRESS,
    resolutionEvidenceStrength: ResolutionEvidenceStrength.WEAK,
    summary: 'Previous state',
    lastTutorQuestion: 'Previous question',
    lastStudentAction: 'Previous action',
    resolved: false,
    updatedAt: new Date('2026-08-10T00:00:00.000Z'),
    ...input,
  }
}

function analysisResult(): EducationalAnalysisResult {
  return {
    requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
    studentState: StudentState.DEBUGGING_ISSUE,
    effortEvidence: {
      present: true,
      quality: 'MEANINGFUL',
      type: 'CODE_ATTEMPT',
      addressesPreviousTutorAction: true,
      isRepeated: false,
      evidenceMessageIds: ['student-message-2'],
    },
    learningEvidence: {
      present: true,
      strength: 'MODERATE',
      evidenceMessageIds: ['student-message-2'],
    },
    misconceptions: [
      {
        code: 'LOOP_UPDATE',
        description: 'The update is skipped.',
        confidence: 0.95,
        evidenceMessageId: 'student-message-2',
      },
    ],
    topicRelation: 'CONTINUE_CURRENT_TOPIC',
    recommendedStrategy: TeachingStrategy.DEBUGGING_GUIDANCE,
    recommendedTechnique: TeachingTechnique.TRACE_EXECUTION,
    recommendedGuidanceLevel: 2,
    confidence: 0.95,
    evidenceReferences: ['student-message-2'],
  }
}

function decision(): PersistedTeachingDecisionRecord {
  return {
    id: 'decision-1',
    attemptId: 'turn-1',
    topicId: 'topic-1',
    analysisId: 'analysis-1',
    strategy: TeachingStrategy.DEBUGGING_GUIDANCE,
    primaryTechnique: TeachingTechnique.TRACE_EXECUTION,
    supportingTechnique: TeachingTechnique.VERIFICATION,
    guidanceLevel: 2,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    reflectionMode: 'NONE',
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
    decisionReason: 'test',
    policyVersion: 'socratic-policy.mvp.v3',
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
  }
}

function approvedResponse(): ApprovedResponse {
  return {
    message: 'Inspect the next loop update.',
    responseIntent: TeachingStrategy.DEBUGGING_GUIDANCE,
    usedCitationIds: [],
    requiresStudentAction: true,
    studentAction: {
      type: TeachingTechnique.TRACE_EXECUTION,
      description: 'Inspect one loop update before moving on.',
    },
    reflectionIncluded: false,
    source: 'VALIDATED_CANDIDATE',
    approvedCandidateAttempt: 1,
    safeFallbackUsed: false,
    approvalMetadata: {
      provider: 'test',
      model: 'test',
      promptVersion: 'test',
      inputTokens: 1,
      outputTokens: 1,
      validationPolicyVersion: 'response-validation.mvp.v4',
      structuralApproved: true,
      deterministicApproved: true,
      semanticApproved: true,
    },
  }
}
