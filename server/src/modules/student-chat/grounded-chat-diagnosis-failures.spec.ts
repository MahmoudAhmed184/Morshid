import { Logger, ServiceUnavailableException } from '@nestjs/common'

import {
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'
import type { AuthenticatedUser } from '../identity/identity.types'
import type {
  BeginGroundedChatTurnInput,
  BeginGroundedChatTurnResult,
  FinalizeGroundedChatTurnInput,
  FinalizeGroundedChatTurnResult,
} from './grounded-chat-turn.repository'
import { AutomaticSafetyRiskDetector } from '../output-policy/automatic-safety-risk.detector'
import { ControlledSourceConflictDetector } from '../output-policy/controlled-source-conflict.detector'
import { OutputPolicyService } from '../output-policy/output-policy.service'
import { CorrectnessSensitiveRequestClassifier } from './correctness-sensitive-request.classifier'
import { GROUNDING_FAILED_CONTENT } from './grounded-chat.constants'
import { GroundedChatService } from './grounded-chat.service'
import type { SocraticChatOrchestrator } from './socratic-chat.orchestrator'
import { StudentChatMessagePresenter } from './student-chat-message.presenter'
import type { ChatMessageRecord } from './student-chat.repository.types'
import type { StudentChatService } from './student-chat.service'

const courseId = 'diagnosis-failure-course'
const sessionId = 'diagnosis-failure-session'
const studentMessageId = 'diagnosis-failure-student-msg'
const assistantMessageId = 'diagnosis-failure-assistant-msg'
const attemptId = 'diagnosis-failure-attempt'
const codeQuestion = [
  'Why does this Python function crash?',
  '```python',
  'def average(nums):',
  '    return total / len(num)',
  '```',
].join('\n')
const user: AuthenticatedUser = {
  id: 'diagnosis-failure-user',
  email: 'student@morshid.test',
  displayName: 'Student',
  role: UserRole.STUDENT,
  status: UserStatus.ACTIVE,
}

describe('GroundedChatService diagnosis failure paths', () => {
  let beginTurn: jest.Mock
  let blockTurn: jest.Mock
  let failTurn: jest.Mock
  let orchestrate: jest.Mock
  let service: GroundedChatService

  beforeEach(() => {
    beginTurn = jest
      .fn()
      .mockImplementation((input: BeginGroundedChatTurnInput) =>
        Promise.resolve(activeTurn(input.content)),
      )
    blockTurn = jest.fn().mockImplementation(terminalResult)
    failTurn = jest.fn().mockImplementation(terminalResult)
    orchestrate = jest.fn().mockResolvedValue({ kind: 'failed' })

    service = new GroundedChatService(
      {
        getSession: jest.fn().mockResolvedValue({ session: { id: sessionId } }),
        recordGroundedTurnDenied: jest.fn().mockResolvedValue(undefined),
      } as unknown as StudentChatService,
      {
        beginTurn,
        retryTurn: jest.fn(),
        completeTurn: jest.fn(),
        completePolicyTurn: jest.fn(),
        completeUnsupportedTurn: jest.fn(),
        completeSafetyTurn: jest.fn(),
        readTurnForStudent: jest.fn(),
        blockTurn,
        failTurn,
      },
      new StudentChatMessagePresenter({
        exists: jest.fn().mockResolvedValue(true),
      } as never),
      { orchestrate } as unknown as SocraticChatOrchestrator,
      {
        message: { findUnique: jest.fn().mockResolvedValue(null) },
      } as never,
      new AutomaticSafetyRiskDetector(),
      new ControlledSourceConflictDetector(),
      new OutputPolicyService(),
      { createRequiredReview: jest.fn().mockResolvedValue(null) } as never,
      new CorrectnessSensitiveRequestClassifier(),
    )
  })

  it('persists a safe failure when Socratic diagnosis orchestration fails', async () => {
    const question = 'What is a list in Python?'
    orchestrate.mockResolvedValue({
      kind: 'failed',
      errorCode: 'SOCRATIC_ORCHESTRATION_FAILED',
    })

    const response = await service.send(
      courseId,
      sessionId,
      { content: question },
      user,
    )

    expect(response.assistantMessage).toMatchObject({
      status: MessageStatus.FAILED,
      content: GROUNDING_FAILED_CONTENT,
      errorCode: 'GROUNDING_RESPONSE_FAILED',
      citations: [],
    })
    expect(beginTurn).toHaveBeenCalledWith(
      expect.objectContaining({ content: question }),
    )
    expect(orchestrate).toHaveBeenCalledWith(
      expect.objectContaining({
        studentMessageContent: question,
        studentMessageId,
        assistantMessageId,
      }),
    )
    expect(failTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        content: GROUNDING_FAILED_CONTENT,
        errorCode: 'GROUNDING_RESPONSE_FAILED',
      }),
    )
  })

  it('does not expose raw orchestration or persistence failures', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    orchestrate.mockRejectedValue(new Error('PRIVATE-DIAGNOSIS-CRASH'))
    failTurn.mockRejectedValue(new Error('PRIVATE-DATABASE-DOWN'))

    await expect(
      service.send(courseId, sessionId, { content: codeQuestion }, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('replays a persisted diagnosis failure without rerunning orchestration', async () => {
    beginTurn.mockResolvedValue({
      kind: 'replayed',
      studentMessage: message({
        id: studentMessageId,
        content: codeQuestion,
        requestKind: MessageRequestKind.CODE_DIAGNOSIS,
      }),
      assistantMessage: message({
        id: assistantMessageId,
        sequence: 2,
        role: MessageRole.ASSISTANT,
        authorUserId: null,
        responseToMessageId: studentMessageId,
        status: MessageStatus.FAILED,
        content: GROUNDING_FAILED_CONTENT,
        errorCode: 'GROUNDING_RESPONSE_FAILED',
        completedAt: new Date(),
      }),
    } satisfies BeginGroundedChatTurnResult)

    const response = await service.send(
      courseId,
      sessionId,
      { clientMessageId: studentMessageId, content: codeQuestion },
      user,
    )

    expect(response.assistantMessage.content).toBe(GROUNDING_FAILED_CONTENT)
    expect(orchestrate).not.toHaveBeenCalled()
  })
})

function activeTurn(content: string): BeginGroundedChatTurnResult {
  return {
    kind: 'ok',
    courseId,
    attemptId,
    studentMessage: message({ id: studentMessageId, content }),
    assistantMessage: message({
      id: assistantMessageId,
      sequence: 2,
      role: MessageRole.ASSISTANT,
      authorUserId: null,
      responseToMessageId: studentMessageId,
      status: MessageStatus.PENDING,
    }),
  }
}

function terminalResult(
  input: FinalizeGroundedChatTurnInput,
): Promise<FinalizeGroundedChatTurnResult> {
  return Promise.resolve({
    kind: 'ok',
    message: message({
      id: assistantMessageId,
      sequence: 2,
      role: MessageRole.ASSISTANT,
      authorUserId: null,
      responseToMessageId: studentMessageId,
      status:
        input.content === GROUNDING_FAILED_CONTENT
          ? MessageStatus.FAILED
          : MessageStatus.BLOCKED,
      content: input.content,
      guidanceLabel:
        input.content === GROUNDING_FAILED_CONTENT
          ? null
          : MessageGuidanceLabel.GENERAL_NOT_FOUND,
      errorCode: input.errorCode,
      completedAt: new Date(),
    }),
  })
}

function message(overrides: Partial<ChatMessageRecord>): ChatMessageRecord {
  return {
    id: 'msg-id',
    sequence: 1,
    role: MessageRole.STUDENT,
    attemptId: null,
    topicId: null,
    authorUserId: user.id,
    responseToMessageId: null,
    content: '',
    status: MessageStatus.COMPLETED,
    requestKind: MessageRequestKind.CONCEPTUAL,
    guidanceLabel: null,
    hintLevel: null,
    promptVersion: null,
    errorCode: null,
    createdAt: new Date(),
    completedAt: null,
    citations: [],
    retrievals: [],
    ...overrides,
  }
}
