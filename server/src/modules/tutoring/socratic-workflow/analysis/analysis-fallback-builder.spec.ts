import {
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  RevealPolicy,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
  TopicStatus,
  TopicType,
} from '../../tutoring-values'
import type { AnalysisContextPackage } from './analysis-context.types'
import { AnalysisFallbackBuilder } from './analysis-fallback-builder'
import {
  EFFORT_QUALITY,
  LEARNING_EVIDENCE_STRENGTH,
} from './educational-analysis.types'
import { validateEducationalAnalysisResult } from './educational-analysis.validator'
import { TOPIC_RESOLUTION_OUTCOME } from '../topic/topic.types'

describe('AnalysisFallbackBuilder', () => {
  it('builds a schema-valid conservative fallback analysis', () => {
    const context = analysisContext()
    const fallback = new AnalysisFallbackBuilder().build(context)

    expect(validateEducationalAnalysisResult(fallback, context)).toMatchObject({
      success: true,
    })
    expect(fallback).toMatchObject({
      requestKind: MessageRequestKind.AMBIGUOUS,
      studentState: StudentState.UNKNOWN,
      effortEvidence: {
        present: false,
        quality: EFFORT_QUALITY.NONE,
        type: null,
        evidenceMessageIds: [],
      },
      learningEvidence: {
        present: false,
        strength: LEARNING_EVIDENCE_STRENGTH.NONE,
        evidenceMessageIds: [],
      },
      misconceptions: [],
      topicRelation: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      recommendedStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
      recommendedTechnique: TeachingTechnique.ORIENTATION_QUESTION,
      recommendedGuidanceLevel: 1,
      evidenceReferences: ['current-message'],
    })
  })

  it('preserves trusted request kind and safe previous strategy when present', () => {
    const context = analysisContext({
      requestKind: MessageRequestKind.CODE_DIAGNOSIS,
      previousStrategy: TeachingStrategy.DEBUGGING_GUIDANCE,
      previousTechnique: TeachingTechnique.TRACE_EXECUTION,
    })

    expect(new AnalysisFallbackBuilder().build(context)).toMatchObject({
      requestKind: MessageRequestKind.CODE_DIAGNOSIS,
      recommendedStrategy: TeachingStrategy.DEBUGGING_GUIDANCE,
      recommendedTechnique: TeachingTechnique.TRACE_EXECUTION,
    })
  })
})

function analysisContext(
  input: {
    requestKind?: MessageRequestKind | null
    previousStrategy?: TeachingStrategy | null
    previousTechnique?: TeachingTechnique | null
  } = {},
): AnalysisContextPackage {
  return {
    studentMessage: {
      id: 'current-message',
      sequence: 1,
      role: MessageRole.STUDENT,
      attemptId: 'turn-1',
      topicId: 'topic-1',
      authorUserId: 'student-1',
      responseToMessageId: null,
      content: 'Can you help me understand this?',
      status: MessageStatus.COMPLETED,
      requestKind: input.requestKind ?? null,
      guidanceLabel: null,
      hintLevel: null,
      createdAt: new Date('2026-08-05T00:00:00.000Z'),
      completedAt: new Date('2026-08-05T00:00:01.000Z'),
    },
    activeTopic: {
      id: 'topic-1',
      sessionId: 'session-1',
      courseId: 'course-1',
      problemId: null,
      conceptId: null,
      title: 'Loops',
      topicType: TopicType.CONCEPT,
      status: TopicStatus.ACTIVE,
      solutionProtectionStatus: 'UNKNOWN',
      solutionProtectionSource: null,
      solutionProtectionPolicyVersion: null,
      solutionProtectionEstablishedAt: null,
      createdAt: new Date('2026-08-05T00:00:00.000Z'),
      updatedAt: new Date('2026-08-05T00:00:00.000Z'),
      resolvedAt: null,
    },
    topicState: null,
    selectedHistory: [],
    previousTutorQuestion: null,
    previousStudentAttempt: null,
    previousTeachingDecision:
      input.previousStrategy === undefined &&
      input.previousTechnique === undefined
        ? null
        : {
            source: 'topic_state',
            activeStrategy: input.previousStrategy ?? null,
            primaryTechnique: input.previousTechnique ?? null,
            supportingTechnique: null,
            guidanceLevel: 1,
            revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
            updatedAt: new Date('2026-08-05T00:00:00.000Z'),
          },
    problemMetadata: null,
    conceptMetadata: null,
    courseMetadata: null,
    conversationLanguage: 'en',
    tokenBudget: {
      maxHistoryTokens: 1200,
      maxHistoryMessages: 24,
      approximateHistoryTokens: 0,
      tokenizer: 'char_approximation_v1',
    },
  }
}
