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

  describe('structured context continuity and switch detection', () => {
    it.each([
      ["I still don't know", 'struggle statement'],
      ['explain that again', 'clarification referencing ongoing explanation'],
      ['what is the next step?', 'task progression inquiry'],
      ['what does this line do?', 'deictic line reference'],
      ['why is it 5?', 'deictic value inquiry'],
      ['how do i continue?', 'progression question'],
      ['what about the loop?', 'contextual follow-up'],
    ])('maintains problem continuation for "%s" (%s)', (messageContent) => {
      const context = analysisContext({
        topicType: TopicType.PROBLEM,
        problemMetadataId: 'problem-1',
        content: messageContent,
      })

      const fallback = new AnalysisFallbackBuilder().build(context)
      expect(fallback.requestKind).toBe(MessageRequestKind.PROBLEM_LIKE)
      expect(fallback.topicRelation).toBe(
        TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      )
    })

    it.each([
      ['What is a Python variable?'],
      ['What is recursion?'],
      ['Explain polymorphism'],
      ['What is the concept of closures?'],
      ['difference between list and tuple'],
    ])('identifies explicit standalone concept request "%s" during active problem as topic switch', (content) => {
      const context = analysisContext({
        topicType: TopicType.PROBLEM,
        problemMetadataId: 'problem-1',
        content,
      })

      const fallback = new AnalysisFallbackBuilder().build(context)
      expect(fallback.requestKind).toBe(MessageRequestKind.CONCEPTUAL)
      expect(fallback.topicRelation).toBe(
        TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
      )
    })

    it('identifies concept inquiries under concept topic as continuation', () => {
      const context = analysisContext({
        topicType: TopicType.CONCEPT,
        conceptMetadataId: 'concept-1',
        content: 'What is a Python variable?',
      })

      const fallback = new AnalysisFallbackBuilder().build(context)
      expect(fallback.requestKind).toBe(MessageRequestKind.CONCEPTUAL)
      expect(fallback.topicRelation).toBe(
        TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      )
    })

    it('maintains continuation when responding to previous tutor question in active problem', () => {
      const base = analysisContext({
        topicType: TopicType.PROBLEM,
        problemMetadataId: 'problem-1',
        content: 'total = 0',
      })
      const context = {
        ...base,
        previousTutorQuestion: {
          source: 'topic_state' as const,
          content: 'What should we initialize total to?',
          messageId: 'tutor-msg-1',
          sequence: 2,
        },
      }

      const fallback = new AnalysisFallbackBuilder().build(context)
      expect(fallback.requestKind).toBe(MessageRequestKind.PROBLEM_LIKE)
      expect(fallback.topicRelation).toBe(
        TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      )
    })
  })
})

function analysisContext(
  input: {
    requestKind?: MessageRequestKind | null
    previousStrategy?: TeachingStrategy | null
    previousTechnique?: TeachingTechnique | null
    topicType?: TopicType
    problemMetadataId?: string | null
    conceptMetadataId?: string | null
    content?: string
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
      content: input.content ?? 'Can you help me understand this?',
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
      problemId: input.problemMetadataId ?? null,
      conceptId: input.conceptMetadataId ?? null,
      title: 'Loops',
      topicType: input.topicType ?? TopicType.UNCLASSIFIED,
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
    problemMetadata:
      input.problemMetadataId !== undefined && input.problemMetadataId !== null
        ? { id: input.problemMetadataId }
        : null,
    conceptMetadata:
      input.conceptMetadataId !== undefined && input.conceptMetadataId !== null
        ? { id: input.conceptMetadataId }
        : null,
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
