import { Test, type TestingModule } from '@nestjs/testing'
import {
  MessageRole,
  MessageStatus,
  RevealPolicy,
  StudentState,
  TopicStatus,
  TopicType,
} from '../../generated/prisma/client'
import {
  AnalysisContextRepository,
  type AnalysisContextBaseInput,
  type AnalysisContextBaseRecord,
  type AnalysisHistoryCandidateInput,
} from './analysis-context.repository'
import type { AnalysisContextMessage } from './analysis-context.types'
import { ContextManager } from './context-manager.service'
import { PrismaService } from '../prisma/prisma.service'
import { SocraticTutorModule } from './socratic-tutor.module'
import { TopicStateRepository } from './topic-state.repository'
import type { TopicStatePatch, TopicStateSnapshot } from './topic-state.types'
import { TopicRepository } from './topic.repository'
import type {
  ActiveTopicReplacementResult,
  TopicRecord,
  TopicScope,
  TopicSessionRecord,
} from './topic.types'

const now = new Date('2026-08-03T12:00:00.000Z')

class FakeAnalysisContextRepository extends AnalysisContextRepository {
  base: AnalysisContextBaseRecord | null = {
    courseMetadata: {
      id: 'course-1',
      code: 'CS101',
      title: 'Intro CS',
    },
    studentMessage: message({ id: 'current', sequence: 5 }),
  }
  candidates: AnalysisContextMessage[] = []

  readonly loadBaseContext = jest.fn((_input: AnalysisContextBaseInput) =>
    Promise.resolve(this.base),
  )

  readonly listHistoryCandidates = jest.fn(
    (_input: AnalysisHistoryCandidateInput) => Promise.resolve(this.candidates),
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
    const { analysisContextRepository, contextManager } = buildHarness()
    analysisContextRepository.candidates = [
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
      analysisContextRepository.listHistoryCandidates,
    ).toHaveBeenCalledWith({
      courseId: 'course-1',
      sessionId: 'session-1',
      studentId: 'student-1',
      topicId: 'topic-1',
      beforeSequence: 5,
    })
  })

  it('returns null when the current student message is outside the active topic', async () => {
    const { analysisContextRepository, contextManager } = buildHarness()
    analysisContextRepository.base = {
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

  it('resolves ContextManager through SocraticTutorModule wiring', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [SocraticTutorModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile()

    expect(moduleRef.get(ContextManager)).toBeInstanceOf(ContextManager)
    await moduleRef.close()
  })
})

function buildHarness() {
  const analysisContextRepository = new FakeAnalysisContextRepository()
  const topicRepository = new FakeTopicRepository()
  const topicStateRepository = new FakeTopicStateRepository()

  return {
    analysisContextRepository,
    topicRepository,
    topicStateRepository,
    contextManager: new ContextManager(
      analysisContextRepository,
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
    turnId: input.turnId ?? null,
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
