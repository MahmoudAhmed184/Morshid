import { ConflictException, ServiceUnavailableException } from '@nestjs/common'

import {
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import type { CompletionProvider } from '../completion/completion-provider'
import type {
  RetrievedChunk,
  RetrievalService,
} from '../retrieval/retrieval.service'
import type {
  BeginGroundedChatTurnResult,
  CompleteGroundedChatTurnInput,
  FinalizeGroundedChatTurnInput,
  FinalizeGroundedChatTurnResult,
  GroundedChatTurnRepository,
  RetryGroundedChatTurnResult,
} from './grounded-chat-turn.repository'
import {
  GROUNDING_BLOCKED_CONTENT,
  GROUNDING_FAILED_CONTENT,
  GroundedChatService,
} from './grounded-chat.service'
import { StudentChatMessagePresenter } from './student-chat-message.presenter'
import type { ChatMessageRecord } from './student-chat.repository.types'
import type { StudentChatService } from './student-chat.service'

const courseId = '17d1a78d-60be-4f5f-a03d-e3ee326ec796'
const sessionId = 'eff4bf27-cce3-45d9-b245-4f1d913f0a27'
const studentMessageId = 'c139776a-0c68-44fe-97f8-e9128aa40458'
const assistantMessageId = '25587e6e-4e6a-4533-9d4f-97be9e63bd96'
const user: AuthenticatedRequestUser = {
  id: '8f9c19d1-eed5-43de-8bd9-995919825f9f',
  email: 'student@morshid.test',
  displayName: 'Student',
  role: UserRole.STUDENT,
  status: UserStatus.ACTIVE,
}

describe('GroundedChatService', () => {
  let getSession: jest.Mock
  let recordGroundedTurnDenied: jest.Mock
  let beginTurn: jest.Mock
  let retryTurn: jest.Mock
  let completeTurn: jest.Mock
  let blockTurn: jest.Mock
  let failTurn: jest.Mock
  let retrieveCourseEvidence: jest.Mock
  let complete: jest.MockedFunction<CompletionProvider['complete']>
  let service: GroundedChatService

  beforeEach(() => {
    getSession = jest.fn().mockResolvedValue({ session: { id: sessionId } })
    recordGroundedTurnDenied = jest.fn().mockResolvedValue(undefined)
    beginTurn = jest.fn().mockResolvedValue(beginOk())
    retryTurn = jest.fn().mockResolvedValue(retryOk())
    completeTurn = jest
      .fn()
      .mockImplementation((input: CompleteGroundedChatTurnInput) =>
        Promise.resolve({
          kind: 'ok',
          message: assistantMessage({
            status: MessageStatus.COMPLETED,
            content: input.content,
            guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
            completedAt: new Date('2026-07-21T12:01:00.000Z'),
          }),
        } satisfies FinalizeGroundedChatTurnResult),
      )
    blockTurn = jest
      .fn()
      .mockImplementation((input: FinalizeGroundedChatTurnInput) =>
        Promise.resolve({
          kind: 'ok',
          message: assistantMessage({
            status: MessageStatus.BLOCKED,
            content: input.content,
            guidanceLabel: MessageGuidanceLabel.GENERAL_NOT_FOUND,
            errorCode: input.errorCode,
            completedAt: new Date('2026-07-21T12:01:00.000Z'),
          }),
        } satisfies FinalizeGroundedChatTurnResult),
      )
    failTurn = jest
      .fn()
      .mockImplementation((input: FinalizeGroundedChatTurnInput) =>
        Promise.resolve({
          kind: 'ok',
          message: assistantMessage({
            status: MessageStatus.FAILED,
            content: input.content,
            errorCode: input.errorCode,
            completedAt: new Date('2026-07-21T12:01:00.000Z'),
          }),
        } satisfies FinalizeGroundedChatTurnResult),
      )
    retrieveCourseEvidence = jest.fn().mockResolvedValue({
      kind: 'evidence',
      chunks: evidenceChunks(),
    })
    complete = jest.fn<CompletionProvider['complete']>().mockResolvedValue({
      content: 'Grounded answer',
      provider: 'deterministic',
      model: 'deterministic-completion-v1',
      promptVersion: 'grounded-completion-v1',
      inputTokens: 10,
      outputTokens: 5,
    })

    const studentChatService = {
      getSession,
      recordGroundedTurnDenied,
    } as unknown as StudentChatService
    const turnRepository = {
      beginTurn,
      retryTurn,
      completeTurn,
      blockTurn,
      failTurn,
    } as unknown as GroundedChatTurnRepository
    const retrievalService = {
      retrieveCourseEvidence,
    } as unknown as RetrievalService
    const completionProvider = { complete } as unknown as CompletionProvider
    const presenter = new StudentChatMessagePresenter({
      exists: jest.fn().mockResolvedValue(true),
    } as never)

    service = new GroundedChatService(
      studentChatService,
      turnRepository,
      retrievalService,
      completionProvider,
      presenter,
    )
  })

  it('sends the exact persisted question and ranked eligible context to completion without orchestration controls', async () => {
    const response = await service.send(
      courseId,
      sessionId,
      { content: 'Explain list iteration' },
      user,
    )

    expect(getSession).toHaveBeenCalledWith(
      courseId,
      sessionId,
      user,
      undefined,
    )
    expect(beginTurn).toHaveBeenCalledWith({
      courseId,
      sessionId,
      studentId: user.id,
      content: 'Explain list iteration',
    })
    expect(retrieveCourseEvidence).toHaveBeenCalledWith(
      courseId,
      'Explain list iteration',
    )
    const completionRequest = complete.mock.calls[0][0]
    expect(completionRequest).toEqual({
      studentQuestion: 'Explain list iteration',
      context: [
        {
          sourceTitle: 'Python lists',
          chunkIndex: 0,
          content: 'First ranked evidence',
        },
        {
          sourceTitle: 'Python loops',
          chunkIndex: 3,
          content: 'Second ranked evidence',
        },
      ],
    })
    expect(Object.keys(completionRequest).sort()).toEqual([
      'context',
      'studentQuestion',
    ])
    expect(completeTurn).toHaveBeenCalledWith({
      courseId,
      sessionId,
      studentId: user.id,
      studentMessageId,
      assistantMessageId,
      content: 'Grounded answer',
      provider: 'deterministic',
      model: 'deterministic-completion-v1',
      promptVersion: 'grounded-completion-v1',
      inputTokens: 10,
      outputTokens: 5,
      evidence: evidenceChunks(),
    })
    expect(response).toMatchObject({
      studentMessage: {
        id: studentMessageId,
        content: 'Explain list iteration',
      },
      assistantMessage: {
        id: assistantMessageId,
        status: MessageStatus.COMPLETED,
        content: 'Grounded answer',
      },
    })
  })

  it('blocks insufficient evidence without calling completion or retaining evidence', async () => {
    retrieveCourseEvidence.mockResolvedValue({ kind: 'insufficient_evidence' })

    const response = await service.send(
      courseId,
      sessionId,
      { content: 'Unknown topic' },
      user,
    )

    expect(complete).not.toHaveBeenCalled()
    expect(completeTurn).not.toHaveBeenCalled()
    expect(blockTurn).toHaveBeenCalledWith({
      courseId,
      sessionId,
      studentId: user.id,
      studentMessageId,
      assistantMessageId,
      content: GROUNDING_BLOCKED_CONTENT,
      errorCode: 'GROUNDING_INSUFFICIENT_EVIDENCE',
    })
    expect(response.assistantMessage).toMatchObject({
      status: MessageStatus.BLOCKED,
      guidanceLabel: MessageGuidanceLabel.GENERAL_NOT_FOUND,
      content: GROUNDING_BLOCKED_CONTENT,
      errorCode: 'GROUNDING_INSUFFICIENT_EVIDENCE',
      citations: [],
    })
  })

  it.each([
    [
      'retrieval',
      () =>
        retrieveCourseEvidence.mockRejectedValue(
          new Error('raw retrieval failure'),
        ),
    ],
    [
      'completion',
      () => complete.mockRejectedValue(new Error('raw provider failure')),
    ],
    [
      'finalization',
      () => completeTurn.mockRejectedValue(new Error('raw database failure')),
    ],
  ])(
    'returns a durable safe failure for a %s failure',
    async (_label, arrange) => {
      arrange()

      const response = await service.send(
        courseId,
        sessionId,
        { content: 'Question text must not become an error' },
        user,
      )

      expect(failTurn).toHaveBeenCalledWith({
        courseId,
        sessionId,
        studentId: user.id,
        studentMessageId,
        assistantMessageId,
        content: GROUNDING_FAILED_CONTENT,
        errorCode: 'GROUNDING_RESPONSE_FAILED',
      })
      expect(response.assistantMessage).toMatchObject({
        status: MessageStatus.FAILED,
        content: GROUNDING_FAILED_CONTENT,
        errorCode: 'GROUNDING_RESPONSE_FAILED',
        citations: [],
      })
    },
  )

  it('returns 503 only when the safe terminal failure cannot be persisted', async () => {
    retrieveCourseEvidence.mockRejectedValue(new Error('retrieval down'))
    failTurn.mockRejectedValue(new Error('database down'))

    await expect(
      service.send(courseId, sessionId, { content: 'Question' }, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('retries with the original persisted Student row and assistant row', async () => {
    const response = await service.retry(
      courseId,
      sessionId,
      studentMessageId,
      user,
    )

    expect(retryTurn).toHaveBeenCalledWith({
      courseId,
      sessionId,
      studentId: user.id,
      studentMessageId,
    })
    expect(retrieveCourseEvidence).toHaveBeenCalledWith(
      courseId,
      'Explain list iteration',
    )
    expect(response).toMatchObject({
      studentMessage: { id: studentMessageId, sequence: 1 },
      assistantMessage: { id: assistantMessageId, sequence: 2 },
    })
  })

  it('maps active work and non-failed retry targets to distinct audited conflicts', async () => {
    beginTurn.mockResolvedValue({ kind: 'turn_in_progress' })
    await expect(
      service.send(courseId, sessionId, { content: 'Question' }, user),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(recordGroundedTurnDenied).toHaveBeenCalledWith({
      courseId,
      sessionId,
      studentId: user.id,
      reason: 'TURN_IN_PROGRESS',
      requestContext: undefined,
    })

    retryTurn.mockResolvedValue({
      kind: 'retry_not_allowed',
      messageId: studentMessageId,
    })
    await expect(
      service.retry(courseId, sessionId, studentMessageId, user),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(recordGroundedTurnDenied).toHaveBeenCalledWith({
      courseId,
      sessionId,
      studentId: user.id,
      messageId: studentMessageId,
      reason: 'RETRY_NOT_ALLOWED',
      requestContext: undefined,
    })
  })
})

function beginOk(): BeginGroundedChatTurnResult {
  return {
    kind: 'ok',
    courseId,
    studentMessage: studentMessage(),
    assistantMessage: assistantMessage(),
  }
}

function retryOk(): RetryGroundedChatTurnResult {
  return beginOk()
}

function studentMessage(): ChatMessageRecord {
  return message({
    id: studentMessageId,
    sequence: 1,
    role: MessageRole.STUDENT,
    authorUserId: user.id,
    responseToMessageId: null,
    content: 'Explain list iteration',
    status: MessageStatus.COMPLETED,
    completedAt: new Date('2026-07-21T12:00:00.000Z'),
  })
}

function assistantMessage(
  overrides: Partial<ChatMessageRecord> = {},
): ChatMessageRecord {
  return message({
    id: assistantMessageId,
    sequence: 2,
    role: MessageRole.ASSISTANT,
    authorUserId: null,
    responseToMessageId: studentMessageId,
    content: '',
    status: MessageStatus.PENDING,
    completedAt: null,
    ...overrides,
  })
}

function message(overrides: Partial<ChatMessageRecord>): ChatMessageRecord {
  return {
    id: 'message-id',
    sequence: 1,
    role: MessageRole.STUDENT,
    authorUserId: user.id,
    responseToMessageId: null,
    content: '',
    status: MessageStatus.COMPLETED,
    requestKind: MessageRequestKind.CONCEPTUAL,
    guidanceLabel: null,
    hintLevel: null,
    errorCode: null,
    createdAt: new Date('2026-07-21T12:00:00.000Z'),
    completedAt: null,
    citations: [],
    retrievals: [],
    ...overrides,
  }
}

function evidenceChunks(): RetrievedChunk[] {
  return [
    {
      chunkId: 'chunk-1',
      materialId: 'material-1',
      materialTitle: 'Python lists',
      chunkIndex: 0,
      content: 'First ranked evidence',
      rank: 1,
      similarityScore: 0.95,
    },
    {
      chunkId: 'chunk-2',
      materialId: 'material-2',
      materialTitle: 'Python loops',
      chunkIndex: 3,
      content: 'Second ranked evidence',
      rank: 2,
      similarityScore: 0.85,
    },
  ]
}
