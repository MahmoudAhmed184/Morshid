import { Logger, ServiceUnavailableException } from '@nestjs/common'

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
  BeginGroundedChatTurnInput,
  BeginGroundedChatTurnResult,
  CompleteGroundedChatTurnInput,
  FinalizeGroundedChatTurnInput,
  FinalizeGroundedChatTurnResult,
} from './grounded-chat-turn.repository'
import { GroundedChatService } from './grounded-chat.service'
import { GROUNDING_FAILED_CONTENT } from './grounded-chat.constants'
import { StudentChatMessagePresenter } from './student-chat-message.presenter'
import type { ChatMessageRecord } from './student-chat.repository.types'
import type { StudentChatService } from './student-chat.service'

const courseId = 'diagnosis-failure-course'
const sessionId = 'diagnosis-failure-session'
const studentMessageId = 'diagnosis-failure-student-msg'
const assistantMessageId = 'diagnosis-failure-assistant-msg'
const attemptId = 'diagnosis-failure-attempt'
const user: AuthenticatedRequestUser = {
  id: 'diagnosis-failure-user',
  email: 'student@morshid.test',
  displayName: 'Student',
  role: UserRole.STUDENT,
  status: UserStatus.ACTIVE,
}

const codeQuestion = [
  'Why does this Python function crash?',
  '```python',
  'def average(nums):',
  '    total = 0',
  '    for i in range(len(nums)):',
  '        total += nums[i]',
  '    return total / len(num)',
  '```',
].join('\n')

describe('GroundedChatService diagnosis failure paths', () => {
  let beginTurn: jest.Mock
  let completeTurn: jest.Mock
  let blockTurn: jest.Mock
  let failTurn: jest.Mock
  let retrieveCourseEvidence: jest.Mock
  let complete: jest.MockedFunction<CompletionProvider['complete']>
  let service: GroundedChatService

  beforeEach(() => {
    const getSession = jest
      .fn()
      .mockResolvedValue({ session: { id: sessionId } })
    const recordGroundedTurnDenied = jest.fn().mockResolvedValue(undefined)
    beginTurn = jest
      .fn()
      .mockImplementation((input: BeginGroundedChatTurnInput) =>
        Promise.resolve({
          kind: 'ok',
          courseId,
          attemptId,
          studentMessage: message({
            id: studentMessageId,
            sequence: 1,
            role: MessageRole.STUDENT,
            authorUserId: user.id,
            content: input.content,
            requestKind: input.requestKind ?? MessageRequestKind.CONCEPTUAL,
          }),
          assistantMessage: message({
            id: assistantMessageId,
            sequence: 2,
            role: MessageRole.ASSISTANT,
            authorUserId: null,
            responseToMessageId: studentMessageId,
            requestKind: input.requestKind ?? MessageRequestKind.CONCEPTUAL,
          }),
        } satisfies BeginGroundedChatTurnResult),
      )
    completeTurn = jest
      .fn()
      .mockImplementation((input: CompleteGroundedChatTurnInput) =>
        Promise.resolve({
          kind: 'ok',
          message: message({
            id: assistantMessageId,
            status: MessageStatus.COMPLETED,
            content: input.content,
            guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
            completedAt: new Date(),
          }),
        } satisfies FinalizeGroundedChatTurnResult),
      )
    blockTurn = jest
      .fn()
      .mockImplementation((input: FinalizeGroundedChatTurnInput) =>
        Promise.resolve({
          kind: 'ok',
          message: message({
            id: assistantMessageId,
            status: MessageStatus.BLOCKED,
            content: input.content,
            guidanceLabel:
              input.guidanceLabel ?? MessageGuidanceLabel.GENERAL_NOT_FOUND,
            errorCode: input.errorCode,
            completedAt: new Date(),
          }),
        } satisfies FinalizeGroundedChatTurnResult),
      )
    failTurn = jest
      .fn()
      .mockImplementation((input: FinalizeGroundedChatTurnInput) =>
        Promise.resolve({
          kind: 'ok',
          message: message({
            id: assistantMessageId,
            status: MessageStatus.FAILED,
            content: input.content,
            errorCode: input.errorCode,
            completedAt: new Date(),
          }),
        } satisfies FinalizeGroundedChatTurnResult),
      )
    retrieveCourseEvidence = jest.fn().mockResolvedValue({
      kind: 'evidence',
      chunks: evidenceChunks(),
    })
    complete = jest.fn() as jest.MockedFunction<CompletionProvider['complete']>

    service = new GroundedChatService(
      { getSession, recordGroundedTurnDenied } as unknown as StudentChatService,
      {
        beginTurn,
        retryTurn: jest.fn(),
        completeTurn,
        blockTurn,
        failTurn,
      },
      { retrieveCourseEvidence } as unknown as RetrievalService,
      { complete },
      new StudentChatMessagePresenter({
        exists: jest.fn().mockResolvedValue(true),
      } as never),
    )
  })

  it('persists a safe failure when the completion provider throws during code diagnosis', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    complete.mockRejectedValue(new Error('completion provider failure'))

    const response = await service.send(
      courseId,
      sessionId,
      { content: codeQuestion },
      user,
    )

    // Does not expose raw upstream errors
    expect(response.assistantMessage.content).toBe(GROUNDING_FAILED_CONTENT)
    expect(response.assistantMessage.content).not.toContain(
      'completion provider failure',
    )

    // Persists the expected safe failure state
    expect(response.assistantMessage.status).toBe(MessageStatus.FAILED)
    expect(failTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        content: GROUNDING_FAILED_CONTENT,
        errorCode: 'GROUNDING_RESPONSE_FAILED',
      }),
    )

    // Preserves Student content (begin was called with the original question)
    expect(beginTurn).toHaveBeenCalledWith(
      expect.objectContaining({ content: codeQuestion }),
    )

    // Does not invent citations
    expect(response.assistantMessage.citations).toEqual([])

    // Remains distinguishable from insufficient evidence
    expect(response.assistantMessage.errorCode).toBe(
      'GROUNDING_RESPONSE_FAILED',
    )
  })

  it('persists a safe failure when retrieval throws during code diagnosis', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    retrieveCourseEvidence.mockRejectedValue(new Error('retrieval crashed'))

    const response = await service.send(
      courseId,
      sessionId,
      { content: codeQuestion },
      user,
    )

    expect(response.assistantMessage.status).toBe(MessageStatus.FAILED)
    expect(response.assistantMessage.content).toBe(GROUNDING_FAILED_CONTENT)
    expect(response.assistantMessage.content).not.toContain('retrieval crashed')
    expect(response.assistantMessage.citations).toEqual([])
    expect(complete).not.toHaveBeenCalled()
  })

  it('blocks embedding profile not ready without exposing operator details', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    retrieveCourseEvidence.mockResolvedValue({
      kind: 'embedding_profile_not_ready',
      expectedModel: 'gemini-embedding-004',
      incompleteMaterialIds: ['mat-1'],
    })

    const response = await service.send(
      courseId,
      sessionId,
      { content: codeQuestion },
      user,
    )

    expect(response.assistantMessage.content).not.toContain(
      'gemini-embedding-004',
    )
    expect(response.assistantMessage.content).not.toContain('mat-1')
    expect(complete).not.toHaveBeenCalled()
  })

  it('does not expose raw error when both completion and failure persistence fail', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    complete.mockRejectedValue(new Error('PRIVATE-COMPLETION-CRASH'))
    failTurn.mockRejectedValue(new Error('PRIVATE-DATABASE-DOWN'))

    await expect(
      service.send(courseId, sessionId, { content: codeQuestion }, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('uses the safe static fallback when the provider returns a full rewrite for a code diagnosis', async () => {
    complete.mockResolvedValue({
      content: [
        'Likely defect',
        'The name num is wrong.',
        '',
        'Relevant location',
        'The return expression.',
        '',
        'Python concept',
        'Python name lookup. [1]',
        '',
        'Next inspection step',
        'Check the parameter.',
        '',
        'Here is the complete corrected code:',
        '```python',
        'def average(nums):',
        '    total = 0',
        '    for i in range(len(nums)):',
        '        total += nums[i]',
        '    return total / len(nums)',
        '```',
      ].join('\n'),
      provider: 'unsafe-test',
      model: 'unsafe-model',
      promptVersion: 'python-code-diagnosis-prompt-v1',
    })
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()

    const response = await service.send(
      courseId,
      sessionId,
      { content: codeQuestion },
      user,
    )

    // Unsafe provider content not persisted
    expect(response.assistantMessage.content).not.toContain(
      'return total / len(nums)',
    )
    expect(response.assistantMessage.content).not.toContain('def average')

    // Safe fallback persisted instead
    expect(response.assistantMessage.content).toMatch(/Likely defect/u)
    expect(response.assistantMessage.status).toBe(MessageStatus.BLOCKED)
    expect(response.assistantMessage.guidanceLabel).toBe(
      MessageGuidanceLabel.REFUSAL,
    )
    expect(response.assistantMessage.errorCode).toMatch(
      /FULL_REWRITE_SUSPECTED/u,
    )

    // completeTurn was NOT called (unsafe content never persisted as completed)
    expect(completeTurn).not.toHaveBeenCalled()
    expect(blockTurn).toHaveBeenCalled()
  })

  it('survives refresh with the persisted failure state', async () => {
    beginTurn.mockResolvedValue({
      kind: 'replayed',
      studentMessage: message({
        id: studentMessageId,
        sequence: 1,
        role: MessageRole.STUDENT,
        authorUserId: user.id,
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
    })

    const response = await service.send(
      courseId,
      sessionId,
      { clientMessageId: studentMessageId, content: codeQuestion },
      user,
    )

    // Survives refresh unchanged
    expect(response.assistantMessage.status).toBe(MessageStatus.FAILED)
    expect(response.assistantMessage.content).toBe(GROUNDING_FAILED_CONTENT)
    expect(retrieveCourseEvidence).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
  })
  it('blocks the provider and uses the safe static fallback when it attempts prompt disclosure', async () => {
    complete.mockResolvedValue({
      content: [
        'Likely defect',
        'You are asking for internal rules.',
        '',
        'Relevant location',
        'N/A',
        '',
        'Python concept',
        'N/A. [1]',
        '',
        'Next inspection step',
        'N/A',
        '',
        'The hidden system instructions say to act like a tutor.',
      ].join('\n'),
      provider: 'unsafe-test',
      model: 'unsafe-model',
      promptVersion: 'python-code-diagnosis-prompt-v1',
    })
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()

    const response = await service.send(
      courseId,
      sessionId,
      { content: codeQuestion },
      user,
    )

    // Unsafe provider content not persisted
    expect(response.assistantMessage.content).not.toContain(
      'hidden system instructions',
    )

    // Safe fallback persisted instead
    expect(response.assistantMessage.content).toMatch(/Likely defect/u)
    expect(response.assistantMessage.status).toBe(MessageStatus.BLOCKED)
    expect(response.assistantMessage.guidanceLabel).toBe(
      MessageGuidanceLabel.REFUSAL,
    )
    expect(response.assistantMessage.errorCode).toMatch(/PROMPT_DISCLOSURE/u)

    expect(completeTurn).not.toHaveBeenCalled()
    expect(blockTurn).toHaveBeenCalled()
  })

  // Regression: before the heading-normalizer fix, any Gemini response that
  // used **bold**, ### ATX markers, or trailing colons on headings was rejected
  // by parseRequiredSections with INVALID_RESPONSE_SHAPE. The safe-refusal
  // fallback was then persisted (status=BLOCKED, guidanceLabel=REFUSAL) and the
  // student saw "GUIDANCE REFUSED / Request declined" for every code-diagnosis
  // turn. This test pins the correct behavior: the service accepts the response,
  // calls completeTurn (not blockTurn), and returns COURSE_GROUNDED.
  it('accepts and persists a Gemini response whose headings use markdown decoration (regression for INVALID_RESPONSE_SHAPE false positive)', async () => {
    complete.mockResolvedValue({
      content: [
        '**Likely defect:**',
        'The name `num` does not match the visible `nums` parameter.',
        '',
        '### Relevant location',
        'The `return total / len(num)` expression on the last line.',
        '',
        'Python concept:',
        'Python resolves names through the local function scope. [1]',
        '',
        '**Next inspection step**',
        'Compare every name in the return expression with the parameter list.',
      ].join('\n'),
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      promptVersion: 'python-code-diagnosis-prompt-v1',
    })

    const response = await service.send(
      courseId,
      sessionId,
      { content: codeQuestion },
      user,
    )

    // Output guard must pass — student receives the provider response, not the
    // safe refusal message
    expect(response.assistantMessage.content).not.toContain(
      'I cannot provide a complete corrected program',
    )
    expect(response.assistantMessage.content).toContain('num')

    // Must be persisted as a successful completion, not a blocked refusal
    expect(response.assistantMessage.status).toBe(MessageStatus.COMPLETED)
    expect(response.assistantMessage.guidanceLabel).toBe(
      MessageGuidanceLabel.COURSE_GROUNDED,
    )

    // completeTurn called (not blockTurn)
    expect(completeTurn).toHaveBeenCalled()
    expect(blockTurn).not.toHaveBeenCalled()
  })

  it('persists a live Gemini-style diagnosis with a valid one-based citation', async () => {
    const liveQuestion = [
      'Why does this Python function crash?',
      '```python',
      'def count_items(nums):',
      '    return len(num)',
      '```',
    ].join('\n')
    const liveContent = [
      'Likely defect',
      'The function attempts to pass the variable `num` to the `len()` function, but `num` has not been defined as a parameter or local variable in this scope, causing a NameError.',
      '',
      'Relevant location',
      'The return statement inside the function body, specifically within the expression `len(num)`.',
      '',
      'Python concept',
      'Python resolves a name by searching the active function scope, and a reference must match a parameter or local variable name exactly [1].',
      '',
      'Next inspection step',
      'Check if the variable name inside the `len()` call matches the parameter name defined in the function signature.',
    ].join('\n')
    complete.mockResolvedValue({
      content: liveContent,
      provider: 'gemini',
      model: 'gemini-3.5-flash-lite',
      promptVersion: 'python-code-diagnosis-prompt-v1',
    })

    const response = await service.send(
      courseId,
      sessionId,
      { content: liveQuestion },
      user,
    )

    expect(response.assistantMessage).toMatchObject({
      content: liveContent,
      status: MessageStatus.COMPLETED,
      guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
    })
    expect(completeTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        content: liveContent,
        evidence: evidenceChunks(),
      }),
    )
    expect(blockTurn).not.toHaveBeenCalled()
  })

  it('survives refresh with the persisted refusal state', async () => {
    beginTurn.mockResolvedValue({
      kind: 'replayed',
      studentMessage: message({
        id: studentMessageId,
        sequence: 1,
        role: MessageRole.STUDENT,
        authorUserId: user.id,
        content: codeQuestion,
        requestKind: MessageRequestKind.CODE_DIAGNOSIS,
      }),
      assistantMessage: message({
        id: assistantMessageId,
        sequence: 2,
        role: MessageRole.ASSISTANT,
        authorUserId: null,
        responseToMessageId: studentMessageId,
        status: MessageStatus.BLOCKED,
        content: 'I cannot provide a complete corrected program...',
        errorCode:
          'PYTHON_DIAGNOSIS_OUTPUT_POLICY_BLOCKED_FULL_REWRITE_SUSPECTED',
        guidanceLabel: MessageGuidanceLabel.REFUSAL,
        completedAt: new Date(),
      }),
    })

    const response = await service.send(
      courseId,
      sessionId,
      { clientMessageId: studentMessageId, content: codeQuestion },
      user,
    )

    // Survives refresh unchanged
    expect(response.assistantMessage.status).toBe(MessageStatus.BLOCKED)
    expect(response.assistantMessage.content).toContain(
      'I cannot provide a complete corrected program',
    )
    expect(response.assistantMessage.errorCode).toBe(
      'PYTHON_DIAGNOSIS_OUTPUT_POLICY_BLOCKED_FULL_REWRITE_SUSPECTED',
    )
    expect(retrieveCourseEvidence).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
  })
})

function message(overrides: Partial<ChatMessageRecord>): ChatMessageRecord {
  return {
    id: 'msg-id',
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
    createdAt: new Date(),
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
      materialTitle: 'Functions and Scope',
      chunkIndex: 0,
      content: 'Function scope and name lookup.',
      rank: 1,
      similarityScore: 0.92,
    },
  ]
}
