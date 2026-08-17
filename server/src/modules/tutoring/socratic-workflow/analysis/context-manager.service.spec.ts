import { Test, type TestingModule } from '@nestjs/testing'
import { ConfigModule, ConfigService } from '@nestjs/config'
import {
  MessageRole,
  MessageStatus,
  RevealPolicy,
  StudentState,
  TopicStatus,
  TopicType,
} from '../../tutoring-values'
import {
  type ConversationAnalysisContextInput,
  type ConversationAnalysisContext,
  type ConversationAnalysisHistoryInput,
} from '../../../conversations/interface/conversation-message-reader'
import type { AnalysisContextMessage } from './analysis-context.types'
import { ContextManager } from './context-manager.service'
import { PrismaService } from '../../../../platform/database/prisma.service'
import { ConversationPresentationModule } from '../../../../application/conversation-presentation.module'
import { SocraticWorkflowModule } from '../socratic-workflow.module'
import { TopicStateRepository } from '../topic/topic-state.repository'
import type {
  TopicStatePatch,
  TopicStateSnapshot,
} from '../topic/topic-state.types'
import { TUTOR_MODEL_PORT } from '../generation/tutor-generation.types'
import { TopicRepository } from '../topic/topic.repository'
import type {
  ActiveTopicReplacementResult,
  TopicRecord,
  TopicScope,
  TopicSessionRecord,
} from '../topic/topic.types'

const now = new Date('2026-08-03T12:00:00.000Z')

class FakeConversationMessages {
  base: ConversationAnalysisContext | null = {
    courseMetadata: {
      id: 'course-1',
      code: 'CS101',
      title: 'Intro CS',
    },
    studentMessage: message({ id: 'current', sequence: 5 }),
  }
  candidates: AnalysisContextMessage[] = []

  readonly find = jest.fn().mockResolvedValue(null)
  readonly countStudentMessages = jest.fn().mockResolvedValue(0)

  readonly loadAnalysisContext = jest.fn(
    (_input: ConversationAnalysisContextInput) => Promise.resolve(this.base),
  )

  readonly listAnalysisHistoryCandidates = jest.fn(
    (_input: ConversationAnalysisHistoryInput) =>
      Promise.resolve(this.candidates),
  )
}

class FakeTopicRepository extends TopicRepository {
  topic: TopicRecord | null = topic()

  readonly findAuthoritativeSession = jest.fn(
    (_sessionId: string): Promise<TopicSessionRecord | null> =>
      Promise.resolve({
        id: 'session-1',
        courseId: 'course-1',
        deletedAt: null,
      }),
  )

  readonly findActiveTopics = jest.fn((_scope: TopicScope) =>
    Promise.resolve(this.topic === null ? [] : [this.topic]),
  )

  readonly findTopicsByProblemId = jest.fn(
    (_scope: TopicScope, _problemId: string) =>
      Promise.resolve(this.topic === null ? [] : [this.topic]),
  )

  readonly findTopicsByConceptId = jest.fn(
    (_scope: TopicScope, _conceptId: string) =>
      Promise.resolve(this.topic === null ? [] : [this.topic]),
  )

  readonly findTopicById = jest.fn((_scope: TopicScope, topicId: string) =>
    Promise.resolve(this.topic?.id === topicId ? this.topic : null),
  )

  readonly createActiveTopic = jest.fn(
    (_input): Promise<ActiveTopicReplacementResult | null> =>
      Promise.resolve(null),
  )

  readonly activateTopic = jest.fn(
    (_input): Promise<ActiveTopicReplacementResult | null> =>
      Promise.resolve(null),
  )

  readonly pauseTopic = jest.fn((_scope: TopicScope, _topicId: string) =>
    Promise.resolve(null),
  )

  readonly resolveTopic = jest.fn(
    (_scope: TopicScope, _topicId: string, _resolvedAt: Date) =>
      Promise.resolve(null),
  )

  readonly countMessagesByIds = jest.fn(
    (_scope: TopicScope, _messageIds: string[]) => Promise.resolve(0),
  )
}

class FakeTopicStateRepository extends TopicStateRepository {
  state: TopicStateSnapshot | null = topicState()

  readonly topicExists = jest.fn((_topicId: string) => Promise.resolve(true))

  readonly findByTopicId = jest.fn((_topicId: string) =>
    Promise.resolve(this.state),
  )

  readonly createForTopic = jest.fn((_topicId: string) =>
    Promise.resolve(this.state),
  )

  readonly applyVersionedPatch = jest.fn(
    (_input: {
      topicId: string
      expectedVersion: number
      patch: TopicStatePatch
    }) => Promise.resolve(this.state),
  )
}

describe('ContextManager', () => {
  it('builds an analysis context without including unrelated topic history', async () => {
    const { conversationMessages, contextManager } = buildHarness()
    conversationMessages.candidates = [
      message({ id: 'topic-history', sequence: 2 }),
      message({
        id: 'question',
        sequence: 3,
        role: MessageRole.ASSISTANT,
        content: 'What is the next algebra step?',
      }),
      message({
        id: 'other-topic',
        sequence: 4,
        topicId: 'topic-2',
        content: 'unrelated',
      }),
    ]

    const context = await contextManager.buildAnalysisContext({
      courseId: 'course-1',
      sessionId: 'session-1',
      studentId: 'student-1',
      studentMessageId: 'current',
      activeTopicId: 'topic-1',
      conversationLanguage: 'en',
    })

    expect(context).toMatchObject({
      studentMessage: { id: 'current' },
      activeTopic: { id: 'topic-1' },
      problemMetadata: { id: 'problem-1' },
      conceptMetadata: { id: 'concept-1' },
      courseMetadata: { code: 'CS101' },
      conversationLanguage: 'en',
      previousTutorQuestion: { messageId: 'question' },
    })
    expect(context?.selectedHistory.map((entry) => entry.id)).toEqual([
      'topic-history',
      'question',
    ])
    expect(context?.selectedHistory).not.toContainEqual(
      expect.objectContaining({ id: 'current' }),
    )
    expect(
      conversationMessages.listAnalysisHistoryCandidates,
    ).toHaveBeenCalledWith({
      courseId: 'course-1',
      sessionId: 'session-1',
      studentId: 'student-1',
      topicId: 'topic-1',
      beforeSequence: 5,
    })
  })

  it('returns null when the current student message is outside the active topic', async () => {
    const { conversationMessages, contextManager } = buildHarness()
    conversationMessages.base = {
      courseMetadata: {
        id: 'course-1',
        code: 'CS101',
        title: 'Intro CS',
      },
      studentMessage: message({
        id: 'current',
        sequence: 5,
        topicId: 'topic-2',
      }),
    }

    await expect(
      contextManager.buildAnalysisContext({
        courseId: 'course-1',
        sessionId: 'session-1',
        studentId: 'student-1',
        studentMessageId: 'current',
        activeTopicId: 'topic-1',
      }),
    ).resolves.toBeNull()
  })

  it('degrades safely when TopicState is missing', async () => {
    const { topicStateRepository, contextManager } = buildHarness()
    topicStateRepository.state = null

    const context = await contextManager.buildAnalysisContext({
      courseId: 'course-1',
      sessionId: 'session-1',
      studentId: 'student-1',
      studentMessageId: 'current',
      activeTopicId: 'topic-1',
    })

    expect(context).toMatchObject({
      topicState: null,
      previousTutorQuestion: null,
      previousStudentAttempt: null,
      previousTeachingDecision: null,
    })
    expect(topicStateRepository.createForTopic).not.toHaveBeenCalled()
  })

  it('does not mutate TopicState while assembling context', async () => {
    const { topicStateRepository, contextManager } = buildHarness()
    const before = { ...topicStateRepository.state }

    await contextManager.buildAnalysisContext({
      courseId: 'course-1',
      sessionId: 'session-1',
      studentId: 'student-1',
      studentMessageId: 'current',
      activeTopicId: 'topic-1',
    })

    expect(topicStateRepository.state).toEqual(before)
    expect(topicStateRepository.applyVersionedPatch).not.toHaveBeenCalled()
  })

  it('resolves ContextManager through SocraticWorkflowModule wiring', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ConversationPresentationModule,
        SocraticWorkflowModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) => {
          switch (key) {
            case 'NODE_ENV':
              return 'test'
            case 'REDIS_URL':
              return 'redis://localhost:6379'
            case 'PDF_STORAGE_PATH':
              return '../storage/pdfs'
            case 'PDF_MAX_UPLOAD_BYTES':
              return 10 * 1024 * 1024
            case 'RETRIEVAL_TOP_K':
              return 5
            case 'RETRIEVAL_MIN_SIMILARITY':
              return 0.62
            case 'TUTORING_REQUEST_TIMEOUT_MS':
              return 120_000
            case 'GEMINI_CHAT_PROJECTS_JSON':
              return '[]'
            case 'ANALYSIS_MODEL_PROVIDER':
              return 'deterministic'
            case 'ANALYSIS_MODEL_TIMEOUT_MS':
              return 30_000
            case 'ANALYSIS_MODEL_MAX_COMPLETION_TOKENS':
              return 2048
            case 'ANALYSIS_MODEL_MAX_RETRIES':
              return 0
            case 'ANALYSIS_CONFIDENCE_THRESHOLD':
              return 0.2
            case 'DEBUGGING_DIAGNOSIS_MODEL_PROVIDER':
              return 'deterministic'
            case 'DEBUGGING_DIAGNOSIS_MODEL_TIMEOUT_MS':
              return 30_000
            case 'DEBUGGING_DIAGNOSIS_MODEL_MAX_COMPLETION_TOKENS':
              return 1024
            case 'DEBUGGING_DIAGNOSIS_MODEL_MAX_RETRIES':
              return 0
            case 'TUTOR_MODEL_PROVIDER':
              return 'deterministic'
            case 'TUTOR_MODEL_TIMEOUT_MS':
              return 30_000
            case 'TUTOR_MODEL_MAX_COMPLETION_TOKENS':
              return 2048
            case 'TUTOR_MODEL_MAX_INFRASTRUCTURE_RETRIES':
              return 1
            case 'SEMANTIC_GUARD_PROVIDER':
              return 'deterministic'
            case 'SEMANTIC_GUARD_TIMEOUT_MS':
              return 30_000
            case 'SEMANTIC_GUARD_MAX_COMPLETION_TOKENS':
              return 256
            default:
              return 'deterministic'
          }
        },
      })
      .compile()

    expect(moduleRef.get(ContextManager)).toBeInstanceOf(ContextManager)
    expect(moduleRef.get(TUTOR_MODEL_PORT)).toBeDefined()
    await moduleRef.close()
  })
})

function buildHarness() {
  const conversationMessages = new FakeConversationMessages()
  const topicRepository = new FakeTopicRepository()
  const topicStateRepository = new FakeTopicStateRepository()

  return {
    conversationMessages,
    topicRepository,
    topicStateRepository,
    contextManager: new ContextManager(
      conversationMessages,
      topicRepository,
      topicStateRepository,
    ),
  }
}

function topic(input: Partial<TopicRecord> = {}): TopicRecord {
  return {
    id: 'topic-1',
    sessionId: 'session-1',
    courseId: 'course-1',
    problemId: 'problem-1',
    conceptId: 'concept-1',
    title: 'Linear equations',
    topicType: TopicType.PROBLEM,
    status: TopicStatus.ACTIVE,
    solutionProtectionStatus: 'UNKNOWN',
    solutionProtectionSource: null,
    solutionProtectionPolicyVersion: null,
    solutionProtectionEstablishedAt: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
    ...input,
  }
}

function topicState(
  input: Partial<TopicStateSnapshot> = {},
): TopicStateSnapshot {
  return {
    id: 'state-1',
    topicId: 'topic-1',
    version: 1,
    requestKind: null,
    studentState: StudentState.UNKNOWN,
    activeStrategy: 'SOCRATIC_QUESTIONING',
    primaryTechnique: null,
    supportingTechnique: null,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    attemptCount: 0,
    meaningfulAttemptCount: 0,
    misconceptionStatus: null,
    learningStatus: 'UNKNOWN',
    resolutionEvidenceStrength: 'NONE',
    summary: null,
    lastTutorQuestion: null,
    lastStudentAction: null,
    resolved: false,
    updatedAt: now,
    ...input,
  }
}

function message(
  input: Partial<AnalysisContextMessage>,
): AnalysisContextMessage {
  return {
    id: input.id ?? 'message-1',
    sequence: input.sequence ?? 1,
    role: input.role ?? MessageRole.STUDENT,
    attemptId: input.attemptId ?? null,
    topicId: input.topicId === undefined ? 'topic-1' : input.topicId,
    authorUserId: input.authorUserId ?? 'student-1',
    responseToMessageId: input.responseToMessageId ?? null,
    content: input.content ?? 'message content',
    status: input.status ?? MessageStatus.COMPLETED,
    requestKind: input.requestKind ?? null,
    guidanceLabel: input.guidanceLabel ?? null,
    hintLevel: input.hintLevel ?? null,
    createdAt: input.createdAt ?? now,
    completedAt: input.completedAt ?? now,
  }
}
