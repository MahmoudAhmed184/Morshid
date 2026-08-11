import {
  CourseMembershipRole,
  MessageRole,
  MessageStatus,
} from '../../../generated/prisma/client'
import type { PrismaService } from '../../../platform/database/prisma.service'
import {
  ANALYSIS_CONTEXT_CANDIDATE_HISTORY_LIMIT,
  PrismaAnalysisContextRepository,
} from './analysis-context.repository'
import type { AnalysisContextMessage } from './analysis-context.types'

const now = new Date('2026-08-03T12:00:00.000Z')

interface LoadBaseQueryArgs {
  where: {
    id: string
    courseId: string
    studentId: string
    deletedAt: null
    membership: {
      role: CourseMembershipRole
      removedAt: null
    }
  }
  select: {
    course: object
    messages: {
      where: {
        id: string
        role: MessageRole
        authorUserId: string
        status: MessageStatus
      }
      select: object
      take: number
    }
  }
}

interface BaseContextQueryResult {
  course: {
    id: string
    code: string
    title: string
  }
  messages: AnalysisContextMessage[]
}

interface HistoryQueryArgs {
  where: {
    sessionId: string
    session: {
      courseId: string
      studentId: string
      deletedAt: null
      membership: {
        role: CourseMembershipRole
        removedAt: null
      }
    }
    topicId: string
    sequence: { lt: number }
    status: MessageStatus
    role: { in: MessageRole[] }
  }
  select: object
  orderBy: [{ sequence: 'desc' }, { id: 'desc' }]
  take: number
}

describe('PrismaAnalysisContextRepository', () => {
  it('loads base context through course, session, student, membership, and current-message scope', async () => {
    const { chatSessionFindFirst, repository } = buildHarness()
    chatSessionFindFirst.mockResolvedValue({
      course: {
        id: 'course-1',
        code: 'CS101',
        title: 'Intro CS',
      },
      messages: [message({ id: 'current' })],
    })

    await expect(
      repository.loadBaseContext({
        courseId: 'course-1',
        sessionId: 'session-1',
        studentId: 'student-1',
        studentMessageId: 'current',
      }),
    ).resolves.toMatchObject({
      courseMetadata: { id: 'course-1' },
      studentMessage: { id: 'current' },
    })
    const query = chatSessionFindFirst.mock.calls[0][0]
    expect(query.where).toEqual({
      id: 'session-1',
      courseId: 'course-1',
      studentId: 'student-1',
      deletedAt: null,
      membership: {
        role: CourseMembershipRole.STUDENT,
        removedAt: null,
      },
    })
    expect(query.select.messages.where).toEqual({
      id: 'current',
      role: MessageRole.STUDENT,
      authorUserId: 'student-1',
      status: MessageStatus.COMPLETED,
    })
    expect(query.select.messages.take).toBe(1)
  })

  it('returns null when the scoped student message is unavailable', async () => {
    const { chatSessionFindFirst, repository } = buildHarness()
    chatSessionFindFirst.mockResolvedValue({
      course: {
        id: 'course-1',
        code: 'CS101',
        title: 'Intro CS',
      },
      messages: [],
    })

    await expect(
      repository.loadBaseContext({
        courseId: 'course-1',
        sessionId: 'session-1',
        studentId: 'student-1',
        studentMessageId: 'missing',
      }),
    ).resolves.toBeNull()
  })

  it('loads bounded same-topic completed history through session, course, and student scope', async () => {
    const { messageFindMany, repository } = buildHarness()
    messageFindMany.mockResolvedValue([
      message({ id: 'later', sequence: 4 }),
      message({ id: 'earlier', sequence: 2 }),
    ])

    const history = await repository.listHistoryCandidates({
      courseId: 'course-1',
      sessionId: 'session-1',
      studentId: 'student-1',
      topicId: 'topic-1',
      beforeSequence: 5,
    })

    expect(history.map((entry) => entry.id)).toEqual(['earlier', 'later'])
    const query = messageFindMany.mock.calls[0][0]
    expect(query).toEqual({
      where: {
        sessionId: 'session-1',
        session: {
          courseId: 'course-1',
          studentId: 'student-1',
          deletedAt: null,
          membership: {
            role: CourseMembershipRole.STUDENT,
            removedAt: null,
          },
        },
        topicId: 'topic-1',
        sequence: { lt: 5 },
        status: MessageStatus.COMPLETED,
        role: { in: [MessageRole.STUDENT, MessageRole.ASSISTANT] },
      },
      select: query.select,
      orderBy: [{ sequence: 'desc' }, { id: 'desc' }],
      take: ANALYSIS_CONTEXT_CANDIDATE_HISTORY_LIMIT,
    })
  })
})

function buildHarness() {
  const chatSessionFindFirst = jest.fn(
    (_input: LoadBaseQueryArgs): Promise<BaseContextQueryResult | null> =>
      Promise.resolve(null),
  )
  const messageFindMany = jest.fn(
    (_input: HistoryQueryArgs): Promise<AnalysisContextMessage[]> =>
      Promise.resolve([]),
  )
  const prismaService = {
    chatSession: {
      findFirst: chatSessionFindFirst,
    },
    message: {
      findMany: messageFindMany,
    },
  } as unknown as PrismaService

  return {
    chatSessionFindFirst,
    messageFindMany,
    repository: new PrismaAnalysisContextRepository(prismaService),
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
