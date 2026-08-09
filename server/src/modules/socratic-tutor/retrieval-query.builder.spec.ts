import {
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
  TopicStatus,
  TopicType,
} from '../../generated/prisma/client'
import type {
  AnalysisContextMessage,
  AnalysisContextPackage,
} from './analysis-context.types'
import type { PersistedEducationalAnalysisRecord } from './educational-analysis.repository'
import {
  EDUCATIONAL_ANALYSIS_SOURCE,
  EFFORT_QUALITY,
  LEARNING_EVIDENCE_STRENGTH,
} from './educational-analysis.types'
import { RetrievalQueryBuilder } from './retrieval-query.builder'
import {
  MAX_RETRIEVAL_QUERY_LENGTH,
  RETRIEVAL_QUERY_VERSION,
  type RetrievalQueryContext,
} from './retrieval-query.types'
import { TOPIC_RESOLUTION_OUTCOME } from './topic.types'

const now = new Date('2026-08-10T00:00:00.000Z')

describe('RetrievalQueryBuilder', () => {
  const builder = new RetrievalQueryBuilder()

  it('reproduces the contextual Python loop hint turn as a standalone search subject', () => {
    const input = context({
      currentContent:
        'Can you give me a small hint without telling me the answer?',
      topicTitle: 'Python for-loop iteration order',
      history: [
        message({
          id: 'attempt',
          sequence: 5,
          content: 'Iteration starts from the last element of the list.',
        }),
        message({
          id: 'question',
          sequence: 6,
          role: MessageRole.ASSISTANT,
          content:
            'Which element is at the very beginning of numbers = [10, 20, 30]?',
        }),
      ],
      previousAttemptId: 'attempt',
      previousQuestionId: 'question',
      misconception: {
        code: 'REVERSED_ITERATION_ORDER',
        description:
          'The student believes a Python for loop starts with the last list element.',
        confidence: 0.95,
        evidenceMessageId: 'attempt',
      },
    })

    const result = builder.build(input)

    expect(result.queryVersion).toBe(RETRIEVAL_QUERY_VERSION)
    expect(result.query).toContain('Python for-loop iteration order')
    expect(result.query).toContain('numbers = [10, 20, 30]')
    expect(result.query).toContain('starts with the last list element')
    expect(result.query).not.toBe(input.currentMessage.content)
    expect(result.contextMessageIds).toEqual(['attempt', 'question'])
  })

  it.each([
    'Give me a hint.',
    'Why?',
    'Can you explain that?',
    "I still don't understand.",
    'What about the second one?',
    'What should I think about next?',
  ])('uses conversation structure for the follow-up %p', (currentContent) => {
    const result = builder.build(
      context({
        currentContent,
        topicTitle: 'Python list iteration',
        history: [
          message({
            id: 'question',
            role: MessageRole.ASSISTANT,
            content: 'Which value is assigned first in values = [4, 8, 12]?',
          }),
        ],
        previousQuestionId: 'question',
      }),
    )

    expect(result.query).toContain('Python list iteration')
    expect(result.query).toContain('values = [4, 8, 12]')
    expect(result.query).toContain(currentContent)
  })

  it('resolves an earlier referenced attempt beyond the latest tutor message', () => {
    const result = builder.build(
      context({
        currentContent: 'What about the second one?',
        topicTitle: 'Python loop variable assignment',
        history: [
          message({
            id: 'earlier-attempt',
            sequence: 2,
            content: 'I think x receives 30 first and then 20.',
          }),
          message({
            id: 'earlier-anchor',
            sequence: 3,
            role: MessageRole.ASSISTANT,
            content: 'Trace x through numbers = [10, 20, 30].',
          }),
          message({
            id: 'latest-tutor',
            sequence: 4,
            role: MessageRole.ASSISTANT,
            content: 'Compare your trace with the list order.',
          }),
        ],
        previousAttemptId: 'earlier-attempt',
        previousQuestionId: 'earlier-anchor',
        evidenceReferences: ['earlier-attempt', 'earlier-anchor'],
      }),
    )

    expect(result.query).toContain('x receives 30 first and then 20')
    expect(result.query).toContain('numbers = [10, 20, 30]')
    expect(result.query).toContain('Compare your trace with the list order')
    expect(result.contextMessageIds).toEqual([
      'earlier-attempt',
      'earlier-anchor',
      'latest-tutor',
    ])
  })

  it('does not contaminate a standalone new subject with old topic context', () => {
    const input = context({
      currentContent: 'How do Python dictionaries store key-value pairs?',
      topicTitle: 'Python loops',
      topicRelation: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
      topicSummary: 'The student is tracing for-loop iteration order.',
      history: [
        message({
          id: 'old-loop-question',
          role: MessageRole.ASSISTANT,
          content: 'Which list element does the loop visit first?',
        }),
      ],
      previousQuestionId: 'old-loop-question',
    })

    expect(builder.build(input)).toEqual({
      query: input.currentMessage.content,
      queryVersion: RETRIEVAL_QUERY_VERSION,
      contextMessageIds: [],
    })
  })

  it('uses only referenced and priority history rather than concatenating selected history', () => {
    const result = builder.build(
      context({
        currentContent: 'Can you clarify?',
        topicTitle: 'Python loops',
        history: [
          message({
            id: 'irrelevant-selected',
            sequence: 1,
            content: 'An old tangent that analysis did not reference.',
          }),
          message({
            id: 'question',
            sequence: 2,
            role: MessageRole.ASSISTANT,
            content: 'What controls the order of loop iteration?',
          }),
        ],
        previousQuestionId: 'question',
      }),
    )

    expect(result.query).not.toContain('old tangent')
    expect(result.query).toContain('controls the order of loop iteration')
  })

  it('is deterministic, normalized, bounded, and carries no course scope', () => {
    const input = context({
      currentContent: `  Explain\nthis ${'x'.repeat(2500)}  `,
      topicTitle: '  Python\niteration  ',
    })

    const first = builder.build(input)
    const second = builder.build(input)

    expect(first).toEqual(second)
    expect(first.query.length).toBeLessThanOrEqual(MAX_RETRIEVAL_QUERY_LENGTH)
    expect(first.query).not.toMatch(/\s{2,}/u)
    expect(first).not.toHaveProperty('courseId')
  })

  it('rejects an empty persisted student message before retrieval', () => {
    expect(() => builder.build(context({ currentContent: ' \n\t ' }))).toThrow(
      'non-empty student message',
    )
  })
})

interface ContextOptions {
  currentContent?: string
  topicTitle?: string
  topicSummary?: string | null
  topicRelation?: PersistedEducationalAnalysisRecord['result']['topicRelation']
  history?: AnalysisContextMessage[]
  previousQuestionId?: string
  previousAttemptId?: string
  evidenceReferences?: string[]
  misconception?: PersistedEducationalAnalysisRecord['result']['misconceptions'][number]
}

function context(options: ContextOptions = {}): RetrievalQueryContext {
  const history = options.history ?? []
  const currentMessage = message({
    id: 'current',
    sequence: 10,
    content: options.currentContent ?? 'Explain this.',
  })
  const base = analysisContextPackage({
    studentMessage: currentMessage,
    selectedHistory: history,
    topicTitle: options.topicTitle,
    topicSummary: options.topicSummary,
    previousQuestionId: options.previousQuestionId,
    previousAttemptId: options.previousAttemptId,
  })

  return {
    currentMessage,
    activeTopic: base.activeTopic,
    topicState: base.topicState,
    previousTutorQuestion: base.previousTutorQuestion,
    previousStudentAttempt: base.previousStudentAttempt,
    selectedHistory: history,
    acceptedAnalysis: analysis({
      topicRelation: options.topicRelation,
      evidenceReferences: options.evidenceReferences,
      misconception: options.misconception,
    }),
  }
}

function analysisContextPackage(input: {
  studentMessage: AnalysisContextMessage
  selectedHistory: AnalysisContextMessage[]
  topicTitle?: string
  topicSummary?: string | null
  previousQuestionId?: string
  previousAttemptId?: string
}): AnalysisContextPackage {
  const reference = (id: string | undefined) => {
    const selected = input.selectedHistory.find((entry) => entry.id === id)
    return selected === undefined
      ? null
      : {
          source: 'selected_history' as const,
          content: selected.content,
          messageId: selected.id,
          sequence: selected.sequence,
        }
  }

  return {
    studentMessage: input.studentMessage,
    activeTopic: {
      id: 'topic-1',
      sessionId: 'session-1',
      courseId: 'trusted-course-1',
      problemId: null,
      conceptId: null,
      title: input.topicTitle ?? 'Python loops',
      topicType: TopicType.CONCEPT,
      status: TopicStatus.ACTIVE,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    topicState: {
      id: 'state-1',
      topicId: 'topic-1',
      version: 1,
      requestKind: null,
      studentState: StudentState.UNKNOWN,
      activeStrategy: null,
      primaryTechnique: null,
      supportingTechnique: null,
      guidanceLevel: 1,
      revealPolicy: 'NO_FINAL_ANSWER',
      attemptCount: 0,
      meaningfulAttemptCount: 0,
      misconceptionStatus: null,
      learningStatus: 'IN_PROGRESS',
      resolutionEvidenceStrength: 'NONE',
      summary: input.topicSummary ?? null,
      lastTutorQuestion: null,
      lastStudentAction: null,
      resolved: false,
      updatedAt: now,
    },
    selectedHistory: input.selectedHistory,
    previousTutorQuestion: reference(input.previousQuestionId),
    previousStudentAttempt: reference(input.previousAttemptId),
    previousTeachingDecision: null,
    problemMetadata: null,
    conceptMetadata: null,
    courseMetadata: {
      id: 'trusted-course-1',
      code: 'PY101',
      title: 'Python',
    },
    conversationLanguage: 'en',
    tokenBudget: {
      maxHistoryTokens: 1200,
      maxHistoryMessages: 24,
      approximateHistoryTokens: 100,
      tokenizer: 'char_approximation_v1',
    },
  }
}

function analysis(input: {
  topicRelation?: PersistedEducationalAnalysisRecord['result']['topicRelation']
  evidenceReferences?: string[]
  misconception?: PersistedEducationalAnalysisRecord['result']['misconceptions'][number]
}): PersistedEducationalAnalysisRecord {
  return {
    id: 'analysis-1',
    turnId: 'turn-current',
    topicId: 'topic-1',
    studentMessageId: 'current',
    attempt: 1,
    result: {
      requestKind: MessageRequestKind.AMBIGUOUS,
      studentState: StudentState.PARTIAL_UNDERSTANDING,
      effortEvidence: {
        present: false,
        quality: EFFORT_QUALITY.NONE,
        type: null,
        addressesPreviousTutorAction: false,
        isRepeated: false,
        evidenceMessageIds: [],
      },
      learningEvidence: {
        present: false,
        strength: LEARNING_EVIDENCE_STRENGTH.NONE,
        evidenceMessageIds: [],
      },
      misconceptions:
        input.misconception === undefined ? [] : [input.misconception],
      topicRelation:
        input.topicRelation ?? TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      recommendedStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
      recommendedTechnique: TeachingTechnique.FOCUSED_QUESTION,
      recommendedGuidanceLevel: 1,
      confidence: 0.9,
      evidenceReferences: input.evidenceReferences ?? ['current'],
    },
    provider: 'test',
    model: 'test',
    modelVersion: 'test-v1',
    promptVersion: 'test-prompt.v1',
    schemaVersion: 'educational-analysis.v1',
    inputTokens: null,
    outputTokens: null,
    latencyMs: null,
    analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
    fallbackReason: null,
    failureCategory: null,
    confidencePolicyVersion: 'test',
    infrastructureRetryCount: 0,
    evidenceLinks: [],
    misconceptionRecords: [],
    createdAt: now,
  }
}

function message(
  input: Partial<AnalysisContextMessage> = {},
): AnalysisContextMessage {
  return {
    id: 'student-message',
    sequence: 1,
    role: MessageRole.STUDENT,
    turnId: 'turn-1',
    topicId: 'topic-1',
    authorUserId: 'student-1',
    responseToMessageId: null,
    content: 'Student message',
    status: MessageStatus.COMPLETED,
    requestKind: MessageRequestKind.CONCEPTUAL,
    guidanceLabel: null,
    hintLevel: null,
    createdAt: now,
    completedAt: now,
    ...input,
  }
}
