import {
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
  TopicStatus,
  TopicType,
} from '../tutoring-values'
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
    expect(result.contextMessageIds).toEqual(['question', 'attempt'])
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
      'earlier-anchor',
      'earlier-attempt',
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

  it('uses bounded same-topic history for an UNRESOLVED contextual Why turn', () => {
    const result = builder.build(
      context({
        currentContent: 'Why?',
        topicRelation: TOPIC_RESOLUTION_OUTCOME.UNRESOLVED,
        topicTitle: 'Python iterator order',
        history: [
          message({
            id: 'same-topic-anchor',
            role: MessageRole.ASSISTANT,
            content:
              'A Python for loop takes values from numbers = [10, 20, 30] in list order.',
          }),
        ],
      }),
    )

    expect(result.query).toContain('Python iterator order')
    expect(result.query).toContain('numbers = [10, 20, 30]')
    expect(result.query).toContain('Current student message: Why?')
    expect(result.contextMessageIds).toEqual(['same-topic-anchor'])
  })

  it.each(['Give me a small hint.', 'Can you explain that?'])(
    'uses a previous same-topic attempt for an UNRESOLVED follow-up %p',
    (currentContent) => {
      const result = builder.build(
        context({
          currentContent,
          topicRelation: TOPIC_RESOLUTION_OUTCOME.UNRESOLVED,
          topicTitle: 'Python for-loop assignment',
          history: [
            message({
              id: 'attempt',
              content: 'I think x receives the final list element first.',
            }),
          ],
          previousAttemptId: 'attempt',
        }),
      )

      expect(result.query).toContain('Python for-loop assignment')
      expect(result.query).toContain('final list element first')
      expect(result.query).toContain(currentContent)
      expect(result.contextMessageIds).toEqual(['attempt'])
    },
  )

  it('keeps an UNRESOLVED turn current-only when no trustworthy anchor exists', () => {
    const input = context({
      currentContent: 'Could you clarify?',
      topicRelation: TOPIC_RESOLUTION_OUTCOME.UNRESOLVED,
      topicTitle: 'Old loop topic',
      topicSummary: 'Old loop discussion that must not be injected.',
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

  it('ignores nested evidence IDs when the evidence is absent', () => {
    const result = builder.build(
      context({
        history: [
          message({
            id: 'forged-effort-reference',
            content: 'FORGED_EFFORT_REFERENCE must not enter retrieval',
          }),
          message({
            id: 'forged-learning-reference',
            content: 'FORGED_LEARNING_REFERENCE must not enter retrieval',
          }),
        ],
        effortEvidence: {
          present: false,
          quality: EFFORT_QUALITY.NONE,
          type: null,
          addressesPreviousTutorAction: false,
          isRepeated: false,
          evidenceMessageIds: ['forged-effort-reference'],
        },
        learningEvidence: {
          present: false,
          strength: LEARNING_EVIDENCE_STRENGTH.NONE,
          evidenceMessageIds: ['forged-learning-reference'],
        },
      }),
    )

    expect(result.query).not.toContain('FORGED_EFFORT_REFERENCE')
    expect(result.query).not.toContain('FORGED_LEARNING_REFERENCE')
    expect(result.contextMessageIds).toEqual([])
  })

  it('bounds oversized context by priority while preserving current-turn content and accurate provenance', () => {
    const currentContent = 'CURRENT_TURN_REQUIRED_ANCHOR'
    const result = builder.build(
      context({
        currentContent,
        topicTitle: `HIGH_PRIORITY_TOPIC ${'t'.repeat(700)}`,
        topicSummary: `LOW_PRIORITY_SUMMARY ${'s'.repeat(1500)}`,
        history: [
          message({
            id: 'previous-question',
            sequence: 4,
            role: MessageRole.ASSISTANT,
            content: `HIGH_PRIORITY_QUESTION ${'q'.repeat(1200)}`,
          }),
          message({
            id: 'previous-attempt',
            sequence: 5,
            content: `HIGH_PRIORITY_ATTEMPT ${'a'.repeat(1200)}`,
          }),
          message({
            id: 'referenced-contributed',
            sequence: 6,
            content: `MEDIUM_HISTORY_CONTRIBUTED ${'h'.repeat(1200)}`,
          }),
          message({
            id: 'referenced-dropped',
            sequence: 7,
            content: `MEDIUM_HISTORY_DROPPED ${'d'.repeat(1200)}`,
          }),
        ],
        previousQuestionId: 'previous-question',
        previousAttemptId: 'previous-attempt',
        evidenceReferences: ['referenced-contributed', 'referenced-dropped'],
        misconception: {
          code: 'OVERSIZED_MISCONCEPTION',
          description: `MEDIUM_MISCONCEPTION ${'m'.repeat(1200)}`,
          confidence: 0.9,
          evidenceMessageId: 'previous-attempt',
        },
      }),
    )

    expect(result.query.length).toBeLessThanOrEqual(MAX_RETRIEVAL_QUERY_LENGTH)
    expect(result.query).toContain(`Current student message: ${currentContent}`)
    expect(result.query).toContain('HIGH_PRIORITY_TOPIC')
    expect(result.query).toContain('HIGH_PRIORITY_QUESTION')
    expect(result.query).toContain('HIGH_PRIORITY_ATTEMPT')
    expect(result.query).toContain('MEDIUM_MISCONCEPTION')
    expect(result.query).toContain('MEDIUM_HISTORY_CONTRIBUTED')
    expect(result.query).not.toContain('MEDIUM_HISTORY_DROPPED')
    expect(result.query).not.toContain('LOW_PRIORITY_SUMMARY')
    expect(result.contextMessageIds).toEqual([
      'previous-question',
      'previous-attempt',
      'referenced-contributed',
    ])
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
    expect(first.query).toContain('Current student message: Explain this')
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
  effortEvidence?: PersistedEducationalAnalysisRecord['result']['effortEvidence']
  learningEvidence?: PersistedEducationalAnalysisRecord['result']['learningEvidence']
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
      effortEvidence: options.effortEvidence,
      learningEvidence: options.learningEvidence,
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
  effortEvidence?: PersistedEducationalAnalysisRecord['result']['effortEvidence']
  learningEvidence?: PersistedEducationalAnalysisRecord['result']['learningEvidence']
  misconception?: PersistedEducationalAnalysisRecord['result']['misconceptions'][number]
}): PersistedEducationalAnalysisRecord {
  return {
    id: 'analysis-1',
    attemptId: 'turn-current',
    topicId: 'topic-1',
    studentMessageId: 'current',
    attempt: 1,
    result: {
      requestKind: MessageRequestKind.AMBIGUOUS,
      studentState: StudentState.PARTIAL_UNDERSTANDING,
      effortEvidence: input.effortEvidence ?? {
        present: false,
        quality: EFFORT_QUALITY.NONE,
        type: null,
        addressesPreviousTutorAction: false,
        isRepeated: false,
        evidenceMessageIds: [],
      },
      learningEvidence: input.learningEvidence ?? {
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
    attemptId: 'turn-1',
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
