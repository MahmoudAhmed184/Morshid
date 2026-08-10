import {
  ConflictException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'

import {
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import type { PrismaService } from '../prisma/prisma.service'
import type {
  BeginGroundedChatTurnResult,
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
import type { SocraticChatOrchestrator } from './socratic-chat.orchestrator'
import type { SocraticOrchestrationResult } from './socratic-chat.types'

const courseId = '17d1a78d-60be-4f5f-a03d-e3ee326ec796'
const sessionId = 'eff4bf27-cce3-45d9-b245-4f1d913f0a27'
const studentMessageId = 'c139776a-0c68-44fe-97f8-e9128aa40458'
const assistantMessageId = '25587e6e-4e6a-4533-9d4f-97be9e63bd96'
const attemptId = '95dbec62-d6d5-4544-9fa7-6e265739cb80'
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
  let blockTurn: jest.Mock
  let failTurn: jest.Mock
  let socraticOrchestrate: jest.Mock
  let service: GroundedChatService

  beforeEach(() => {
    getSession = jest.fn().mockResolvedValue({ session: { id: sessionId } })
    recordGroundedTurnDenied = jest.fn().mockResolvedValue(undefined)
    beginTurn = jest.fn().mockResolvedValue(beginOk())
    retryTurn = jest.fn().mockResolvedValue(retryOk())
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

    const studentChatService = {
      getSession,
      recordGroundedTurnDenied,
    } as unknown as StudentChatService
    const turnRepository = {
      beginTurn,
      retryTurn,
      blockTurn,
      failTurn,
    } as unknown as GroundedChatTurnRepository
    const presenter = new StudentChatMessagePresenter({
      exists: jest.fn().mockResolvedValue(true),
    } as never)
    socraticOrchestrate = jest.fn().mockResolvedValue({
      kind: 'completed',
      studentMessage: studentMessage(),
      assistantMessage: assistantMessage({
        status: MessageStatus.COMPLETED,
        content: 'Socratic grounded answer',
        guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
        completedAt: new Date('2026-07-21T12:01:00.000Z'),
      }),
    } satisfies SocraticOrchestrationResult)
    const socraticOrchestrator = {
      orchestrate: socraticOrchestrate,
    } as unknown as SocraticChatOrchestrator

    service = new GroundedChatService(
      studentChatService,
      turnRepository,
      presenter,
      socraticOrchestrator,
      {
        message: {
          findUnique: jest.fn().mockImplementation(({ where }) =>
            Promise.resolve({
              ...studentMessage(),
              id: (where as { id: string }).id,
            }),
          ),
        },
      } as unknown as PrismaService,
    )
  })

  it('delegates to the Socratic orchestrator for new messages', async () => {
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
    expect(socraticOrchestrate).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId,
        sessionId,
        studentId: user.id,
        studentMessageId,
        assistantMessageId,
        studentMessageContent: 'Explain list iteration',
      }),
    )
    expect(response).toMatchObject({
      studentMessage: {
        id: studentMessageId,
        content: 'Explain list iteration',
      },
      assistantMessage: {
        id: assistantMessageId,
        status: MessageStatus.COMPLETED,
        content: 'Socratic grounded answer',
      },
    })
  })

  it('returns a terminal idempotent replay without generating again', async () => {
    beginTurn.mockResolvedValue({
      kind: 'replayed',
      studentMessage: studentMessage(),
      assistantMessage: assistantMessage({
        status: MessageStatus.COMPLETED,
        content: 'Already generated',
      }),
    })

    const response = await service.send(
      courseId,
      sessionId,
      {
        clientMessageId: studentMessageId,
        content: 'Explain list iteration',
      },
      user,
    )

    expect(response.assistantMessage.content).toBe('Already generated')
    expect(beginTurn).toHaveBeenCalledWith({
      clientMessageId: studentMessageId,
      courseId,
      sessionId,
      studentId: user.id,
      content: 'Explain list iteration',
    })
    expect(socraticOrchestrate).not.toHaveBeenCalled()
  })

  it('blocks when orchestrator returns blocked result', async () => {
    socraticOrchestrate.mockResolvedValue({
      kind: 'blocked',
      reason: 'insufficient_evidence',
    } satisfies SocraticOrchestrationResult)

    const response = await service.send(
      courseId,
      sessionId,
      { content: 'Unknown topic' },
      user,
    )

    expect(blockTurn).toHaveBeenCalledWith({
      courseId,
      sessionId,
      studentId: user.id,
      attemptId,
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

  it('returns a durable safe failure when orchestrator fails', async () => {
    socraticOrchestrate.mockResolvedValue({
      kind: 'failed',
      errorCode: 'SOCRATIC_ORCHESTRATION_FAILED',
    } satisfies SocraticOrchestrationResult)

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
      attemptId,
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
  })

  it('returns 503 only when the safe terminal failure cannot be persisted', async () => {
    socraticOrchestrate.mockRejectedValue(new Error('orchestration down'))
    failTurn.mockRejectedValue(new Error('database down'))

    await expect(
      service.send(courseId, sessionId, { content: 'Question' }, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('returns safe failure when orchestrator fails and cleanup succeeds', async () => {
    socraticOrchestrate.mockResolvedValue({
      kind: 'failed',
      errorCode: 'SOCRATIC_APPROVAL_FAILED:MISSING_TEACHING_DECISION',
    } satisfies SocraticOrchestrationResult)

    const response = await service.send(
      courseId,
      sessionId,
      { content: 'Question before membership removal' },
      user,
    )

    expect(failTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptId,
        studentMessageId,
        assistantMessageId,
      }),
    )
    expect(response.assistantMessage.status).toBe(MessageStatus.FAILED)
  })

  it('returns the already-persisted completed message when failTurn recovers it', async () => {
    socraticOrchestrate.mockRejectedValue(
      new Error('orchestration acknowledgement unavailable'),
    )
    failTurn.mockResolvedValue({
      kind: 'ok',
      message: assistantMessage({
        status: MessageStatus.COMPLETED,
        content: 'Already committed grounded answer',
        guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
        completedAt: new Date('2026-07-21T12:01:00.000Z'),
      }),
    })

    const response = await service.send(
      courseId,
      sessionId,
      { content: 'Question with an ambiguous orchestration acknowledgement' },
      user,
    )

    expect(response.assistantMessage).toMatchObject({
      status: MessageStatus.COMPLETED,
      content: 'Already committed grounded answer',
    })
  })

  it.each([
    [
      'begin',
      () => beginTurn.mockRejectedValue(new Error('PRIVATE-BEGIN-ERROR')),
      () =>
        service.send(
          courseId,
          sessionId,
          { content: 'PRIVATE-QUESTION' },
          user,
        ),
    ],
    [
      'retry',
      () => retryTurn.mockRejectedValue(new Error('PRIVATE-RETRY-ERROR')),
      () => service.retry(courseId, sessionId, studentMessageId, user),
    ],
    [
      'socratic_orchestration',
      () =>
        socraticOrchestrate.mockRejectedValue(
          new Error('PRIVATE-ORCHESTRATION-ERROR'),
        ),
      () =>
        service.send(
          courseId,
          sessionId,
          { content: 'PRIVATE-QUESTION' },
          user,
        ),
    ],
    [
      'blocked_persistence',
      () => {
        socraticOrchestrate.mockResolvedValue({
          kind: 'blocked',
          reason: 'insufficient_evidence',
        })
        blockTurn.mockRejectedValue(new Error('PRIVATE-BLOCK-ERROR'))
      },
      () =>
        service.send(
          courseId,
          sessionId,
          { content: 'PRIVATE-QUESTION' },
          user,
        ),
    ],
    [
      'failed_persistence',
      () => {
        socraticOrchestrate.mockRejectedValue(
          new Error('PRIVATE-ORCHESTRATION-ERROR'),
        )
        failTurn.mockRejectedValue(new Error('PRIVATE-FAILURE-ERROR'))
      },
      () =>
        service.send(
          courseId,
          sessionId,
          { content: 'PRIVATE-QUESTION' },
          user,
        ),
    ],
  ])(
    'emits sanitized structured %s telemetry without private orchestration data',
    async (phase, arrange, act) => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
      arrange()

      await act().catch(() => undefined)

      const calls = warn.mock.calls as unknown as [unknown, ...unknown[]][]
      const event = calls
        .map(([entry]) => entry)
        .find(isTelemetryEventFor(phase))
      expect(event).toMatchObject({
        event: 'grounded_chat_phase_failed',
        phase,
        errorClass: 'Error',
        courseId,
        sessionId,
        studentId: user.id,
      })
      expect(event).toHaveProperty('operationId')

      const serializedLogs = JSON.stringify(calls)
      for (const secret of [
        'PRIVATE-BEGIN-ERROR',
        'PRIVATE-RETRY-ERROR',
        'PRIVATE-ORCHESTRATION-ERROR',
        'PRIVATE-BLOCK-ERROR',
        'PRIVATE-FAILURE-ERROR',
        'PRIVATE-QUESTION',
      ]) {
        expect(serializedLogs).not.toContain(secret)
      }
      warn.mockRestore()
    },
  )

  it('retries through the Socratic orchestrator with the persisted student message', async () => {
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
    expect(socraticOrchestrate).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId,
        sessionId,
        studentId: user.id,
        studentMessageId,
        studentMessageContent: 'Explain list iteration',
      }),
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

function beginOk(): Extract<BeginGroundedChatTurnResult, { kind: 'ok' }> {
  return {
    kind: 'ok',
    courseId,
    attemptId,
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
    turnId: null,
    topicId: null,
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
    promptVersion: overrides.promptVersion ?? null,
  }
}

function isTelemetryEventFor(
  phase: string,
): (entry: unknown) => entry is Record<string, unknown> {
  return (entry): entry is Record<string, unknown> =>
    typeof entry === 'object' &&
    entry !== null &&
    'phase' in entry &&
    entry.phase === phase
}
