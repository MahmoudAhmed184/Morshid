import { Logger, ServiceUnavailableException } from '@nestjs/common'

import {
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
} from './tutoring-values'
import { UserRole, UserStatus } from '../identity/identity.roles'
import type { AuthenticatedUser } from '../identity/identity.types'
import type {
  BeginTutoringTurnInput,
  BeginTutoringTurnResult,
  FinalizeTutoringTurnInput,
  FinalizeTutoringTurnResult,
} from './attempt/tutoring-turn.repository'
import { AutomaticSafetyRiskDetector } from './response-governance/automatic-safety-risk.detector'
import { ControlledSourceConflictDetector } from './response-governance/controlled-source-conflict.detector'
import { ResponseGovernance } from './response-governance/response-governance'
import { CorrectnessSensitiveRequestClassifier } from './response-governance/correctness-sensitive-request.classifier'
import { GROUNDING_FAILED_CONTENT } from './attempt/tutoring.constants'
import { TutoringRuntimeApplication } from './tutoring-runtime.application'
import type { SocraticWorkflow } from './socratic-workflow/socratic-workflow'
import { ApplicationConversationMessagePresenter } from '../../application/conversation-message.presenter'
import type { ChatMessageRecord } from '../conversations/interface/conversation-records'

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

describe('TutoringRuntimeApplication diagnosis failure paths', () => {
  let beginTurn: jest.Mock
  let blockTurn: jest.Mock
  let failTurn: jest.Mock
  let orchestrate: jest.Mock
  let service: TutoringRuntimeApplication

  beforeEach(() => {
    beginTurn = jest
      .fn()
      .mockImplementation((input: BeginTutoringTurnInput) =>
        Promise.resolve(activeTurn(input.content)),
      )
    blockTurn = jest.fn().mockImplementation(terminalResult)
    failTurn = jest.fn().mockImplementation(terminalResult)
    orchestrate = jest.fn().mockResolvedValue({ kind: 'failed' })

    service = new TutoringRuntimeApplication(
      {
        beginTurn,
        retryTurn: jest.fn(),
        transitionAttempt: jest.fn().mockResolvedValue(true),
        repairAutomaticReview: jest.fn(),
        completeTurn: jest.fn(),
        completePolicyTurn: jest.fn(),
        completeUnsupportedTurn: jest.fn(),
        completeSafetyTurn: jest.fn(),
        readTurnForStudent: jest.fn(),
        blockTurn,
        failTurn,
      },
      new ApplicationConversationMessagePresenter(
        {
          loadForMessages: jest.fn().mockResolvedValue([]),
          loadPolicyEvidence: jest.fn().mockResolvedValue([]),
        },
        { loadForMessages: jest.fn().mockResolvedValue([]) },
      ),
      { run: orchestrate } as unknown as SocraticWorkflow,
      {
        find: jest.fn().mockResolvedValue(null),
        loadAnalysisContext: jest.fn(),
        listAnalysisHistoryCandidates: jest.fn(),
        countStudentMessages: jest.fn(),
      } as never,
      new AutomaticSafetyRiskDetector(),
      new ControlledSourceConflictDetector(),
      new ResponseGovernance(),
      new CorrectnessSensitiveRequestClassifier(),
      { recordEvent: jest.fn().mockResolvedValue(undefined) } as never,
      { loadPolicyEvidence: jest.fn().mockResolvedValue([]) } as never,
    )
  })

  const runNew = (content: string, clientMessageId = studentMessageId) =>
    service.run({
      kind: 'new',
      courseId,
      sessionId,
      studentId: user.id,
      content,
      clientMessageId,
    })

  it('persists a safe failure when Socratic diagnosis orchestration fails', async () => {
    const question = 'What is a list in Python?'
    orchestrate.mockResolvedValue({
      kind: 'failed',
      errorCode: 'SOCRATIC_ORCHESTRATION_FAILED',
    })

    const response = await runNew(question)

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

    await expect(runNew(codeQuestion)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
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
    } satisfies BeginTutoringTurnResult)

    const response = await runNew(codeQuestion, studentMessageId)

    expect(response.assistantMessage.content).toBe(GROUNDING_FAILED_CONTENT)
    expect(orchestrate).not.toHaveBeenCalled()
  })
})

function activeTurn(content: string): BeginTutoringTurnResult {
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
  input: FinalizeTutoringTurnInput,
): Promise<FinalizeTutoringTurnResult> {
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
    ...overrides,
  }
}
