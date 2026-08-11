import { ConversationMessageReader } from '../../conversations/conversation-message-reader'
import {
  ANALYSIS_CONTEXT_CANDIDATE_HISTORY_LIMIT,
  PrismaAnalysisContextRepository,
} from './analysis-context.repository'
import type { AnalysisContextMessage } from './analysis-context.types'

const now = new Date('2026-08-03T12:00:00.000Z')

class FakeConversationMessageReader extends ConversationMessageReader {
  loadAnalysisContext = jest.fn()
  listAnalysisHistoryCandidates = jest.fn()
  countStudentMessages = jest.fn()

  find = jest.fn()
}

describe('PrismaAnalysisContextRepository', () => {
  it('delegates the scoped base context read to Conversations', async () => {
    const reader = new FakeConversationMessageReader()
    reader.loadAnalysisContext.mockResolvedValue({
      courseMetadata: {
        id: 'course-1',
        code: 'CS101',
        title: 'Intro CS',
      },
      studentMessage: message({ id: 'current' }),
    })
    const repository = new PrismaAnalysisContextRepository(reader)

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
    expect(reader.loadAnalysisContext).toHaveBeenCalledWith({
      courseId: 'course-1',
      sessionId: 'session-1',
      studentId: 'student-1',
      studentMessageId: 'current',
    })
  })

  it('returns null when Conversations cannot find the scoped student message', async () => {
    const reader = new FakeConversationMessageReader()
    reader.loadAnalysisContext.mockResolvedValue(null)
    const repository = new PrismaAnalysisContextRepository(reader)

    await expect(
      repository.loadBaseContext({
        courseId: 'course-1',
        sessionId: 'session-1',
        studentId: 'student-1',
        studentMessageId: 'missing',
      }),
    ).resolves.toBeNull()
  })

  it('delegates bounded history selection without introducing a second transcript read path', async () => {
    const reader = new FakeConversationMessageReader()
    reader.listAnalysisHistoryCandidates.mockResolvedValue([
      message({ id: 'earlier', sequence: 2 }),
      message({ id: 'later', sequence: 4 }),
    ])
    const repository = new PrismaAnalysisContextRepository(reader)
    const input = {
      courseId: 'course-1',
      sessionId: 'session-1',
      studentId: 'student-1',
      topicId: 'topic-1',
      beforeSequence: 5,
    }

    await expect(repository.listHistoryCandidates(input)).resolves.toHaveLength(
      2,
    )
    expect(reader.listAnalysisHistoryCandidates).toHaveBeenCalledWith(input)
    expect(ANALYSIS_CONTEXT_CANDIDATE_HISTORY_LIMIT).toBe(80)
  })
})

function message(
  input: Partial<AnalysisContextMessage>,
): AnalysisContextMessage {
  return {
    id: input.id ?? 'message-1',
    sequence: input.sequence ?? 1,
    role: input.role ?? 'STUDENT',
    attemptId: input.attemptId ?? null,
    topicId: input.topicId === undefined ? 'topic-1' : input.topicId,
    authorUserId: input.authorUserId ?? 'student-1',
    responseToMessageId: input.responseToMessageId ?? null,
    content: input.content ?? 'message content',
    status: input.status ?? 'COMPLETED',
    requestKind: input.requestKind ?? null,
    guidanceLabel: input.guidanceLabel ?? null,
    hintLevel: input.hintLevel ?? null,
    createdAt: input.createdAt ?? now,
    completedAt: input.completedAt ?? now,
  }
}
