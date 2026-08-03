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
} from '../../generated/prisma/client'
import type {
  AnalysisContextMessage,
  AnalysisContextPackage,
} from './analysis-context.types'
import {
  EDUCATIONAL_ANALYSIS_LIMITS,
  SUPPORTED_EDUCATIONAL_ANALYSIS_REQUEST_KINDS,
  SUPPORTED_EDUCATIONAL_ANALYSIS_STUDENT_STATES,
  SUPPORTED_EFFORT_QUALITIES,
  SUPPORTED_EFFORT_TYPES,
  SUPPORTED_LEARNING_EVIDENCE_STRENGTHS,
  SUPPORTED_RECOMMENDED_TEACHING_STRATEGIES,
  SUPPORTED_RECOMMENDED_TEACHING_TECHNIQUES,
  SUPPORTED_TOPIC_RELATIONS,
} from './educational-analysis.schema'
import {
  EDUCATIONAL_ANALYSIS_SCHEMA_VERSION,
  EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY,
  EFFORT_QUALITY,
  EFFORT_TYPE,
  LEARNING_EVIDENCE_STRENGTH,
  type EducationalAnalysisResult,
} from './educational-analysis.types'
import { validateEducationalAnalysisResult } from './educational-analysis.validator'
import { TOPIC_RESOLUTION_OUTCOME } from './topic.types'

const now = new Date('2026-08-03T12:00:00.000Z')

describe('educational analysis schema validation', () => {
  it('accepts a canonical complete Educational Analysis result', () => {
    const result = validateEducationalAnalysisResult(
      validEducationalAnalysisResult(),
      analysisContext(),
    )

    expect(result).toMatchObject({
      success: true,
      data: {
        schemaVersion: EDUCATIONAL_ANALYSIS_SCHEMA_VERSION,
        requestKind: MessageRequestKind.CODE_DIAGNOSIS,
        studentState: StudentState.DEBUGGING_ISSUE,
        recommendedStrategy: TeachingStrategy.DEBUGGING_GUIDANCE,
        recommendedTechnique: TeachingTechnique.TRACE_EXECUTION,
        recommendedGuidanceLevel: 2,
      },
    })
  })

  it.each(SUPPORTED_EDUCATIONAL_ANALYSIS_REQUEST_KINDS)(
    'accepts RequestKind %s',
    (requestKind) => {
      expectValid({ requestKind })
    },
  )

  it.each(SUPPORTED_EDUCATIONAL_ANALYSIS_STUDENT_STATES)(
    'accepts StudentState %s',
    (studentState) => {
      expectValid({ studentState })
    },
  )

  it.each(SUPPORTED_EFFORT_QUALITIES)(
    'accepts effort quality %s',
    (quality) => {
      expectValid({
        effortEvidence:
          quality === EFFORT_QUALITY.NONE
            ? {
                ...validEducationalAnalysisResult().effortEvidence,
                present: false,
                quality,
                type: null,
                evidenceMessageIds: [],
              }
            : {
                ...validEducationalAnalysisResult().effortEvidence,
                present: true,
                quality,
                type: EFFORT_TYPE.REASONING_ATTEMPT,
                evidenceMessageIds: ['current-message'],
              },
      })
    },
  )

  it.each(SUPPORTED_EFFORT_TYPES)('accepts effort type %s', (type) => {
    expectValid({
      effortEvidence: {
        ...validEducationalAnalysisResult().effortEvidence,
        type,
      },
    })
  })

  it.each(SUPPORTED_LEARNING_EVIDENCE_STRENGTHS)(
    'accepts learning evidence strength %s',
    (strength) => {
      expectValid({
        learningEvidence:
          strength === LEARNING_EVIDENCE_STRENGTH.NONE
            ? {
                ...validEducationalAnalysisResult().learningEvidence,
                present: false,
                strength,
                evidenceMessageIds: [],
              }
            : {
                ...validEducationalAnalysisResult().learningEvidence,
                present: true,
                strength,
                evidenceMessageIds: ['current-message'],
              },
      })
    },
  )

  it.each(SUPPORTED_TOPIC_RELATIONS)(
    'accepts TopicRelation %s',
    (topicRelation) => {
      expectValid({ topicRelation })
    },
  )

  it.each(SUPPORTED_RECOMMENDED_TEACHING_STRATEGIES)(
    'accepts recommended strategy %s',
    (recommendedStrategy) => {
      expectValid({ recommendedStrategy })
    },
  )

  it.each(SUPPORTED_RECOMMENDED_TEACHING_TECHNIQUES)(
    'accepts recommended technique %s',
    (recommendedTechnique) => {
      expectValid({ recommendedTechnique })
    },
  )

  it.each([1, 2, 3, 4])(
    'accepts recommended Guidance Level %s',
    (recommendedGuidanceLevel) => {
      expectValid({ recommendedGuidanceLevel })
    },
  )

  it.each([0, 0.42, 1])('accepts confidence %s', (confidence) => {
    expectValid({ confidence })
  })

  it('accepts valid evidence references from the supplied analysis context', () => {
    expectValid({
      evidenceReferences: [
        'current-message',
        'previous-student-attempt',
        'previous-tutor-question',
      ],
      effortEvidence: {
        ...validEducationalAnalysisResult().effortEvidence,
        evidenceMessageIds: ['previous-student-attempt'],
      },
      learningEvidence: {
        ...validEducationalAnalysisResult().learningEvidence,
        present: true,
        strength: LEARNING_EVIDENCE_STRENGTH.WEAK,
        evidenceMessageIds: ['previous-tutor-question'],
      },
    })
  })

  it.each([
    [
      'missing required field',
      withoutKey(validEducationalAnalysisResult(), 'requestKind'),
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.MISSING_REQUIRED_FIELD,
    ],
    [
      'unsupported RequestKind',
      { ...validEducationalAnalysisResult(), requestKind: 'DIRECT_ANSWER' },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_ENUM,
    ],
    [
      'unsupported StudentState',
      { ...validEducationalAnalysisResult(), studentState: 'EXPERT' },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_ENUM,
    ],
    [
      'unsupported strategy',
      {
        ...validEducationalAnalysisResult(),
        recommendedStrategy: 'ANSWER_REVEAL',
      },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_ENUM,
    ],
    [
      'unsupported technique',
      { ...validEducationalAnalysisResult(), recommendedTechnique: 'LECTURE' },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_ENUM,
    ],
    [
      'non-integer Guidance Level',
      { ...validEducationalAnalysisResult(), recommendedGuidanceLevel: 2.5 },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.MALFORMED_INPUT,
    ],
    [
      'Guidance Level below range',
      { ...validEducationalAnalysisResult(), recommendedGuidanceLevel: 0 },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_RANGE,
    ],
    [
      'Guidance Level above range',
      { ...validEducationalAnalysisResult(), recommendedGuidanceLevel: 5 },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.BOUND_EXCEEDED,
    ],
    [
      'confidence below range',
      { ...validEducationalAnalysisResult(), confidence: -0.01 },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_RANGE,
    ],
    [
      'confidence above range',
      { ...validEducationalAnalysisResult(), confidence: 1.01 },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.BOUND_EXCEEDED,
    ],
    [
      'malformed effort object',
      {
        ...validEducationalAnalysisResult(),
        effortEvidence: {
          ...validEducationalAnalysisResult().effortEvidence,
          present: true,
          type: null,
        },
      },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_NESTED_SHAPE,
    ],
    [
      'malformed learning object',
      {
        ...validEducationalAnalysisResult(),
        learningEvidence: {
          ...validEducationalAnalysisResult().learningEvidence,
          present: true,
          strength: LEARNING_EVIDENCE_STRENGTH.NONE,
        },
      },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_NESTED_SHAPE,
    ],
    [
      'malformed misconception object',
      {
        ...validEducationalAnalysisResult(),
        misconceptions: [
          {
            ...validEducationalAnalysisResult().misconceptions[0],
            confidence: 'high',
          },
        ],
      },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.MALFORMED_INPUT,
    ],
    [
      'empty misconception code',
      {
        ...validEducationalAnalysisResult(),
        misconceptions: [
          { ...validEducationalAnalysisResult().misconceptions[0], code: '' },
        ],
      },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_RANGE,
    ],
    [
      'empty misconception description',
      {
        ...validEducationalAnalysisResult(),
        misconceptions: [
          {
            ...validEducationalAnalysisResult().misconceptions[0],
            description: '',
          },
        ],
      },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_RANGE,
    ],
    [
      'oversized misconception description',
      {
        ...validEducationalAnalysisResult(),
        misconceptions: [
          {
            ...validEducationalAnalysisResult().misconceptions[0],
            description: 'x'.repeat(
              EDUCATIONAL_ANALYSIS_LIMITS.maxMisconceptionDescriptionCodePoints +
                1,
            ),
          },
        ],
      },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_NESTED_SHAPE,
    ],
    [
      'oversized evidence array',
      {
        ...validEducationalAnalysisResult(),
        evidenceReferences: Array.from(
          {
            length: EDUCATIONAL_ANALYSIS_LIMITS.maxEvidenceReferences + 1,
          },
          (_value, index) => `message-${String(index)}`,
        ),
      },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.BOUND_EXCEEDED,
    ],
    [
      'unknown top-level field',
      { ...validEducationalAnalysisResult(), providerPayload: {} },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.UNKNOWN_FIELD,
    ],
    [
      'unsupported schema version',
      {
        ...validEducationalAnalysisResult(),
        schemaVersion: 'educational-analysis.v2',
      },
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.UNSUPPORTED_SCHEMA_VERSION,
    ],
    [
      'malformed provider-shaped input',
      '{not valid json',
      EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.MALFORMED_INPUT,
    ],
  ])('rejects %s', (_name, raw, category) => {
    const issues = expectInvalid(raw)

    expect(issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ category })]),
    )
  })

  it.each([
    [
      'unknown overall evidence ID',
      { evidenceReferences: ['invented-message'] },
      'evidenceReferences.0',
    ],
    [
      'duplicate overall evidence ID',
      { evidenceReferences: ['current-message', 'current-message'] },
      'evidenceReferences.1',
    ],
    [
      'evidence ID absent from current context',
      { evidenceReferences: ['foreign-message'] },
      'evidenceReferences.0',
    ],
    [
      'evidence ID from another topic in selected history',
      { evidenceReferences: ['other-topic-message'] },
      'evidenceReferences.0',
    ],
    [
      'invalid misconception evidence ID',
      {
        misconceptions: [
          {
            ...validEducationalAnalysisResult().misconceptions[0],
            evidenceMessageId: 'invented-message',
          },
        ],
      },
      'misconceptions.0.evidenceMessageId',
    ],
    [
      'invalid effort evidence ID',
      {
        effortEvidence: {
          ...validEducationalAnalysisResult().effortEvidence,
          evidenceMessageIds: ['invented-message'],
        },
      },
      'effortEvidence.evidenceMessageIds.0',
    ],
    [
      'invalid learning evidence ID',
      {
        learningEvidence: {
          ...validEducationalAnalysisResult().learningEvidence,
          present: true,
          strength: LEARNING_EVIDENCE_STRENGTH.WEAK,
          evidenceMessageIds: ['invented-message'],
        },
      },
      'learningEvidence.evidenceMessageIds.0',
    ],
  ])('rejects %s', (_name, patch, path) => {
    const issues = expectInvalid(
      { ...validEducationalAnalysisResult(), ...patch },
      analysisContext({
        selectedHistory: [
          message({ id: 'previous-student-attempt', sequence: 1 }),
          message({
            id: 'previous-tutor-question',
            sequence: 2,
            role: MessageRole.ASSISTANT,
            content: 'What value changes?',
          }),
          message({
            id: 'other-topic-message',
            sequence: 3,
            topicId: 'other-topic',
          }),
        ],
      }),
    )

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category:
            EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_EVIDENCE_REFERENCE,
          path,
        }),
      ]),
    )
  })

  it('validates overall evidence references independently of nested evidence arrays', () => {
    const issues = expectInvalid({
      ...validEducationalAnalysisResult(),
      evidenceReferences: ['invented-message'],
      effortEvidence: {
        ...validEducationalAnalysisResult().effortEvidence,
        evidenceMessageIds: ['current-message'],
      },
      learningEvidence: {
        ...validEducationalAnalysisResult().learningEvidence,
        evidenceMessageIds: [],
      },
    })

    expect(issues.map((issue) => issue.path)).toEqual(['evidenceReferences.0'])
  })

  it('does not mutate raw input or AnalysisContextPackage', () => {
    const raw = validEducationalAnalysisResult()
    const context = analysisContext()
    const rawBefore = structuredClone(raw)
    const contextBefore = structuredClone(context)

    validateEducationalAnalysisResult(raw, context)

    expect(raw).toEqual(rawBefore)
    expect(context).toEqual(contextBefore)
  })

  it('is deterministic for identical input and context', () => {
    const raw = validEducationalAnalysisResult()
    const context = analysisContext()

    expect(validateEducationalAnalysisResult(raw, context)).toEqual(
      validateEducationalAnalysisResult(raw, context),
    )
  })

  it('keeps recommendations as data and does not mutate TopicState', () => {
    const context = analysisContext({
      topicState: {
        id: 'topic-state-1',
        topicId: 'topic-1',
        version: 3,
        requestKind: MessageRequestKind.CONCEPTUAL,
        studentState: StudentState.PARTIAL_UNDERSTANDING,
        activeStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
        primaryTechnique: TeachingTechnique.FOCUSED_QUESTION,
        supportingTechnique: null,
        guidanceLevel: 1,
        revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
        attemptCount: 2,
        meaningfulAttemptCount: 1,
        misconceptionStatus: null,
        learningStatus: 'IN_PROGRESS',
        resolutionEvidenceStrength: 'NONE',
        summary: null,
        lastTutorQuestion: 'What changes in the loop?',
        lastStudentAction: 'I tried tracing it.',
        resolved: false,
        updatedAt: now,
      },
    })
    const before = structuredClone(context.topicState)

    expectValid(
      {
        recommendedStrategy: TeachingStrategy.DEBUGGING_GUIDANCE,
        recommendedTechnique: TeachingTechnique.TRACE_EXECUTION,
        recommendedGuidanceLevel: 4,
      },
      context,
    )

    expect(context.topicState).toEqual(before)
  })
})

function expectValid(
  patch: Partial<EducationalAnalysisResult> = {},
  context: AnalysisContextPackage = analysisContext(),
): void {
  expect(
    validateEducationalAnalysisResult(
      { ...validEducationalAnalysisResult(), ...patch },
      context,
    ),
  ).toMatchObject({ success: true })
}

function expectInvalid(
  raw: unknown,
  context: AnalysisContextPackage = analysisContext(),
) {
  const result = validateEducationalAnalysisResult(raw, context)

  expect(result.success).toBe(false)
  if (result.success) {
    throw new Error('Expected Educational Analysis validation to fail')
  }

  return result.issues
}

function validEducationalAnalysisResult(): EducationalAnalysisResult {
  return {
    schemaVersion: EDUCATIONAL_ANALYSIS_SCHEMA_VERSION,
    requestKind: MessageRequestKind.CODE_DIAGNOSIS,
    studentState: StudentState.DEBUGGING_ISSUE,
    effortEvidence: {
      present: true,
      quality: EFFORT_QUALITY.MEANINGFUL,
      type: EFFORT_TYPE.CODE_ATTEMPT,
      addressesPreviousTutorAction: false,
      isRepeated: false,
      evidenceMessageIds: ['current-message'],
    },
    learningEvidence: {
      present: false,
      strength: LEARNING_EVIDENCE_STRENGTH.NONE,
      evidenceMessageIds: [],
    },
    misconceptions: [
      {
        code: 'NON_SHRINKING_SEARCH_INTERVAL',
        description: 'The search interval update does not remove the midpoint.',
        confidence: 0.88,
        evidenceMessageId: 'current-message',
      },
    ],
    topicRelation: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
    recommendedStrategy: TeachingStrategy.DEBUGGING_GUIDANCE,
    recommendedTechnique: TeachingTechnique.TRACE_EXECUTION,
    recommendedGuidanceLevel: 2,
    confidence: 0.9,
    evidenceReferences: ['current-message'],
  }
}

function analysisContext(
  overrides: Partial<AnalysisContextPackage> = {},
): AnalysisContextPackage {
  const activeTopic = {
    id: 'topic-1',
    sessionId: 'session-1',
    courseId: 'course-1',
    problemId: null,
    conceptId: null,
    title: 'Binary search loop',
    topicType: TopicType.DEBUGGING_TASK,
    status: TopicStatus.ACTIVE,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  const selectedHistory = overrides.selectedHistory ?? [
    message({ id: 'previous-student-attempt', sequence: 1 }),
    message({
      id: 'previous-tutor-question',
      sequence: 2,
      role: MessageRole.ASSISTANT,
      content: 'What value changes?',
    }),
  ]

  return {
    studentMessage: message({
      id: 'current-message',
      sequence: 3,
      topicId: activeTopic.id,
    }),
    activeTopic,
    topicState: null,
    selectedHistory,
    previousTutorQuestion: {
      source: 'selected_history',
      content: 'What value changes?',
      messageId: 'previous-tutor-question',
      sequence: 2,
    },
    previousStudentAttempt: {
      source: 'selected_history',
      content: 'I tried changing left = mid.',
      messageId: 'previous-student-attempt',
      sequence: 1,
    },
    previousTeachingDecision: null,
    problemMetadata: null,
    conceptMetadata: null,
    courseMetadata: {
      id: activeTopic.courseId,
      code: 'CS101',
      title: 'Algorithms',
    },
    conversationLanguage: 'en',
    tokenBudget: {
      maxHistoryTokens: 1200,
      maxHistoryMessages: 24,
      approximateHistoryTokens: 12,
      tokenizer: 'char_approximation_v1',
    },
    ...overrides,
  }
}

function message(
  overrides: Partial<AnalysisContextMessage> = {},
): AnalysisContextMessage {
  return {
    id: 'message-1',
    sequence: 1,
    role: MessageRole.STUDENT,
    turnId: 'turn-1',
    topicId: 'topic-1',
    authorUserId: 'student-1',
    responseToMessageId: null,
    content: 'I tried changing left = mid but the loop does not stop.',
    status: MessageStatus.COMPLETED,
    requestKind: null,
    guidanceLabel: null,
    hintLevel: null,
    createdAt: now,
    completedAt: now,
    ...overrides,
  }
}

function withoutKey(
  value: EducationalAnalysisResult,
  key: keyof EducationalAnalysisResult,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([entryKey]) => entryKey !== key),
  )
}
