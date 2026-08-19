import {
  ConflictException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'

import {
  ExplanationDetailLevel,
  MessageGuidanceLabel,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  TeachingStrategy,
  TeachingTechnique,
  TutoringApprovalSource,
} from './tutoring-values'
import { UserRole, UserStatus } from '../identity/identity.roles'
import type { AuthenticatedUser } from '../identity/identity.types'
import type {
  BeginTutoringTurnResult,
  CompleteTutoringTurnInput,
  FinalizeTutoringTurnInput,
  FinalizeTutoringTurnResult,
  TutoringTurnRepository,
  RetryTutoringTurnResult,
} from './attempt/tutoring-turn.repository'
import type { RunTutoringTurnCommand } from './interface/run-tutoring-turn-command'
import {
  GROUNDING_BLOCKED_CONTENT,
  GROUNDING_FAILED_CONTENT,
  TutoringRuntimeApplication,
} from './tutoring-runtime.application'
import { AutomaticSafetyRiskDetector } from './response-governance/automatic-safety-risk.detector'
import { ControlledSourceConflictDetector } from './response-governance/controlled-source-conflict.detector'
import { ResponseGovernance } from './response-governance/response-governance'
import { CorrectnessSensitiveRequestClassifier } from './response-governance/correctness-sensitive-request.classifier'
import { ApplicationConversationMessagePresenter } from '../../application/conversation-message.presenter'
import type { ChatMessageRecord } from '../conversations/interface/conversation-records'
import type { SocraticWorkflow } from './socratic-workflow/socratic-workflow'
import type { SocraticWorkflowResult } from './socratic-workflow/socratic-workflow.types'

const courseId = '17d1a78d-60be-4f5f-a03d-e3ee326ec796'
const sessionId = 'eff4bf27-cce3-45d9-b245-4f1d913f0a27'
const studentMessageId = 'c139776a-0c68-44fe-97f8-e9128aa40458'
const assistantMessageId = '25587e6e-4e6a-4533-9d4f-97be9e63bd96'
const attemptId = '95dbec62-d6d5-4544-9fa7-6e265739cb80'
const user: AuthenticatedUser = {
  id: '8f9c19d1-eed5-43de-8bd9-995919825f9f',
  email: 'student@morshid.test',
  displayName: 'Student',
  role: UserRole.STUDENT,
  status: UserStatus.ACTIVE,
  universityId: 'univ-1',
}

describe('TutoringRuntimeApplication', () => {
  let recordEvent: jest.Mock
  let beginTurn: jest.Mock
  let retryTurn: jest.Mock
  let completeTurn: jest.Mock
  let blockTurn: jest.Mock
  let failTurn: jest.Mock
  let socraticOrchestrate: jest.Mock
  let service: TutoringRuntimeApplication

  beforeEach(() => {
    recordEvent = jest.fn().mockResolvedValue(undefined)
    beginTurn = jest.fn().mockResolvedValue(beginOk())
    retryTurn = jest.fn().mockResolvedValue(retryOk())
    completeTurn = jest
      .fn()
      .mockImplementation((input: CompleteTutoringTurnInput) =>
        Promise.resolve({
          kind: 'ok',
          message: assistantMessage({
            status: MessageStatus.COMPLETED,
            content: input.content,
            guidanceLabel: input.guidanceLabel ?? null,
            completedAt: new Date('2026-07-21T12:01:00.000Z'),
          }),
        } satisfies FinalizeTutoringTurnResult),
      )
    blockTurn = jest
      .fn()
      .mockImplementation((input: FinalizeTutoringTurnInput) =>
        Promise.resolve({
          kind: 'ok',
          message: assistantMessage({
            status: MessageStatus.BLOCKED,
            content: input.content,
            guidanceLabel: MessageGuidanceLabel.GENERAL_NOT_FOUND,
            errorCode: input.errorCode,
            completedAt: new Date('2026-07-21T12:01:00.000Z'),
          }),
        } satisfies FinalizeTutoringTurnResult),
      )
    failTurn = jest
      .fn()
      .mockImplementation((input: FinalizeTutoringTurnInput) =>
        Promise.resolve({
          kind: 'ok',
          message: assistantMessage({
            status: MessageStatus.FAILED,
            content: input.content,
            errorCode: input.errorCode,
            completedAt: new Date('2026-07-21T12:01:00.000Z'),
          }),
        } satisfies FinalizeTutoringTurnResult),
      )

    const turnRepository = {
      beginTurn,
      retryTurn,
      completeTurn,
      completePolicyTurn: jest.fn().mockImplementation(() =>
        Promise.resolve({
          kind: 'ok',
          message: assistantMessage({
            status: MessageStatus.COMPLETED,
            content: 'Socratic grounded answer',
            guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
            completedAt: new Date('2026-07-21T12:01:00.000Z'),
          }),
        } satisfies FinalizeTutoringTurnResult),
      ),
      blockTurn,
      failTurn,
    } as unknown as TutoringTurnRepository
    const presenter = new ApplicationConversationMessagePresenter(
      {
        loadForMessages: jest.fn().mockResolvedValue([]),
        loadPolicyEvidence: jest.fn().mockResolvedValue([]),
      },
      {
        loadForMessages: jest.fn().mockResolvedValue([]),
        loadPublishedGuidanceForMessages: jest.fn().mockResolvedValue([]),
      },
    )
    socraticOrchestrate = jest.fn().mockResolvedValue({
      kind: 'completed',
      completion: {
        kind: 'classified',
        content: 'Socratic grounded answer',
        requestKind: MessageRequestKind.CONCEPTUAL,
        guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
        errorCode: 'SOCRATIC_CLASSIFIED_RESPONSE',
        promptVersion: 'socratic-classification.v1',
        topicId: 'topic-1',
        topicStateTransition: {
          expectedVersion: 1,
          patch: { requestKind: MessageRequestKind.CONCEPTUAL },
        },
      },
    } satisfies SocraticWorkflowResult)
    const socraticWorkflow = {
      run: socraticOrchestrate,
    } as unknown as SocraticWorkflow

    service = new TutoringRuntimeApplication(
      turnRepository,
      presenter,
      socraticWorkflow,
      {
        find: jest.fn().mockImplementation(({ id }: { id: string }) => {
          if (id === studentMessageId) {
            return Promise.resolve(studentMessage())
          }
          return Promise.resolve(null)
        }),
        loadAnalysisContext: jest.fn(),
        listAnalysisHistoryCandidates: jest.fn(),
        countStudentMessages: jest.fn(),
      },
      new AutomaticSafetyRiskDetector(),
      new ControlledSourceConflictDetector(),
      new ResponseGovernance(),
      new CorrectnessSensitiveRequestClassifier(),
      { recordEvent } as never,
      { loadPolicyEvidence: jest.fn().mockResolvedValue([]) } as never,
    )
  })

  const runNew = (
    content: string,
    options: Partial<
      Pick<
        Extract<RunTutoringTurnCommand, { kind: 'new' }>,
        'clientMessageId' | 'problemId' | 'conceptId' | 'title'
      >
    > = {},
  ) =>
    service.run({
      kind: 'new',
      courseId,
      sessionId,
      studentId: user.id,
      clientMessageId: studentMessageId,
      content,
      ...options,
    })

  const runRetry = (targetAttemptId = attemptId) =>
    service.run({
      kind: 'retry',
      courseId,
      sessionId,
      studentId: user.id,
      attemptId: targetAttemptId,
    })

  it('delegates to the Socratic orchestrator for new messages', async () => {
    const response = await runNew('Explain list iteration')
    expect(beginTurn).toHaveBeenCalledWith({
      courseId,
      sessionId,
      studentId: user.id,
      clientMessageId: studentMessageId,
      content: 'Explain list iteration',
      requestKind: MessageRequestKind.CONCEPTUAL,
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

  it('routes new-turn commands through the TutoringRuntime entry point', async () => {
    const response = await service.run({
      kind: 'new',
      courseId,
      sessionId,
      studentId: user.id,
      content: 'Explain list iteration',
      clientMessageId: 'client-message-1',
      problemId: '2c4d4f3a-7e37-4c6c-8d8b-9c6a3f9a6e11',
      conceptId: '8e8a2e4a-f2f5-4d63-9dc8-4f7f5c02b2a6',
      title: 'Binary search boundaries',
    })

    expect(beginTurn).toHaveBeenCalledWith({
      courseId,
      sessionId,
      studentId: user.id,
      clientMessageId: 'client-message-1',
      content: 'Explain list iteration',
      requestKind: MessageRequestKind.CONCEPTUAL,
    })
    expect(response.assistantMessage.content).toBe('Socratic grounded answer')
  })

  it('passes stable topic identity from the HTTP request to orchestration', async () => {
    await runNew('Explain this problem', {
      problemId: '2c4d4f3a-7e37-4c6c-8d8b-9c6a3f9a6e11',
      conceptId: '8e8a2e4a-f2f5-4d63-9dc8-4f7f5c02b2a6',
      title: 'Binary search boundaries',
    })

    expect(socraticOrchestrate).toHaveBeenCalledWith(
      expect.objectContaining({
        topicSelection: {
          problemId: '2c4d4f3a-7e37-4c6c-8d8b-9c6a3f9a6e11',
          conceptId: '8e8a2e4a-f2f5-4d63-9dc8-4f7f5c02b2a6',
          title: 'Binary search boundaries',
        },
      }),
    )
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

    const response = await runNew('Explain list iteration', {
      clientMessageId: studentMessageId,
    })

    expect(response.assistantMessage.content).toBe('Already generated')
    expect(beginTurn).toHaveBeenCalledWith({
      clientMessageId: studentMessageId,
      courseId,
      sessionId,
      studentId: user.id,
      content: 'Explain list iteration',
      requestKind: MessageRequestKind.CONCEPTUAL,
    })
    expect(socraticOrchestrate).not.toHaveBeenCalled()
  })

  it('does not label a generic safe fallback as course grounded', async () => {
    socraticOrchestrate.mockResolvedValue({
      kind: 'completed',
      completion: {
        kind: 'approved',
        approvedResponse: {
          message: 'Show the last step you were confident about.',
          responseIntent: TeachingStrategy.SOCRATIC_QUESTIONING,
          usedCitationIds: [],
          requiresStudentAction: true,
          studentAction: {
            type: TeachingTechnique.FOCUSED_QUESTION,
            description: 'Share one small reasoning step.',
          },
          reflectionIncluded: false,
          source: 'SAFE_FALLBACK',
          approvedCandidateAttempt: null,
          safeFallbackUsed: true,
          approvalMetadata: {
            provider: null,
            model: null,
            promptVersion: 'safe-fallback.mvp.v2',
            inputTokens: 0,
            outputTokens: 0,
            validationPolicyVersion: 'response-validation.mvp.v1',
            structuralApproved: false,
            deterministicApproved: false,
            semanticApproved: null,
          },
        },
        evidence: [
          {
            chunkId: 'chunk-1',
            materialId: 'material-1',
            materialTitle: 'Course material',
            chunkIndex: 0,
            content: 'Retrieved course context remains auditable.',
            rank: 1,
            similarityScore: 0.95,
            embeddingModel: 'test-embedding',
          },
        ],
        requestKind: MessageRequestKind.CONCEPTUAL,
        topicId: 'topic-1',
        guidanceLevel: 1,
        safeFallbackReason: 'VALIDATION_EXHAUSTED',
        auditGraph: {
          candidateAttempts: [],
          guardResults: [],
          outputProtection: {
            protectTargetSolution: false,
            topicId: 'topic-1',
            source: 'ACCEPTED_CONCEPT_ANALYSIS',
            policyVersion: 'solution-protection.v1',
          },
          outputRiskEvents: [],
        },
        topicStateTransition: {
          expectedVersion: 1,
          patch: { summary: 'Safe fallback completed.' },
        },
      },
    } satisfies SocraticWorkflowResult)

    const response = await runNew('Help me reason through this')

    expect(completeTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalSource: TutoringApprovalSource.SAFE_FALLBACK,
        guidanceLabel: null,
        provider: null,
        model: null,
        citationContextIndexes: [],
        evidence: [
          expect.objectContaining({
            chunkId: 'chunk-1',
            materialId: 'material-1',
          }),
        ],
      }),
    )
    expect(response.assistantMessage).toMatchObject({
      status: MessageStatus.COMPLETED,
      guidanceLabel: null,
      citations: [],
    })
  })

  it('blocks when orchestrator returns blocked result', async () => {
    socraticOrchestrate.mockResolvedValue({
      kind: 'blocked',
      reason: 'insufficient_evidence',
      topicId: null,
    } satisfies SocraticWorkflowResult)

    const response = await runNew('Unknown topic')

    expect(blockTurn).toHaveBeenCalledWith({
      courseId,
      sessionId,
      studentId: user.id,
      attemptId,
      studentMessageId,
      assistantMessageId,
      content: GROUNDING_BLOCKED_CONTENT,
      errorCode: 'GROUNDING_INSUFFICIENT_EVIDENCE',
      topicId: null,
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
      topicId: null,
    } satisfies SocraticWorkflowResult)

    const response = await runNew('Explain list iteration safely')

    expect(failTurn).toHaveBeenCalledWith({
      courseId,
      sessionId,
      studentId: user.id,
      attemptId,
      studentMessageId,
      assistantMessageId,
      content: GROUNDING_FAILED_CONTENT,
      errorCode: 'GROUNDING_RESPONSE_FAILED',
      topicId: null,
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

    await expect(runNew('Question')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })

  it('returns safe failure when orchestrator fails and cleanup succeeds', async () => {
    socraticOrchestrate.mockResolvedValue({
      kind: 'failed',
      errorCode: 'SOCRATIC_APPROVAL_FAILED:MISSING_TEACHING_DECISION',
      topicId: null,
    } satisfies SocraticWorkflowResult)

    const response = await runNew('Question before membership removal')

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

    const response = await runNew(
      'Question with an ambiguous orchestration acknowledgement',
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
      () => runNew('PRIVATE-QUESTION'),
    ],
    [
      'retry',
      () => retryTurn.mockRejectedValue(new Error('PRIVATE-RETRY-ERROR')),
      () => runRetry(),
    ],
    [
      'socratic_orchestration',
      () =>
        socraticOrchestrate.mockRejectedValue(
          new Error('PRIVATE-ORCHESTRATION-ERROR'),
        ),
      () => runNew('PRIVATE-QUESTION'),
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
      () => runNew('PRIVATE-QUESTION'),
    ],
    [
      'failed_persistence',
      () => {
        socraticOrchestrate.mockRejectedValue(
          new Error('PRIVATE-ORCHESTRATION-ERROR'),
        )
        failTurn.mockRejectedValue(new Error('PRIVATE-FAILURE-ERROR'))
      },
      () => runNew('PRIVATE-QUESTION'),
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
        event: 'tutoring_runtime_phase_failed',
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
    retryTurn.mockResolvedValue({
      ...retryOk(),
      studentMessage: studentMessage({
        topicId: 'topic-that-must-be-resumed',
      }),
    })

    const response = await runRetry()

    expect(retryTurn).toHaveBeenCalledWith({
      courseId,
      sessionId,
      studentId: user.id,
      attemptId,
    })
    expect(socraticOrchestrate).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId,
        sessionId,
        studentId: user.id,
        studentMessageId,
        studentMessageContent: 'Explain list iteration',
        topicSelection: { topicId: 'topic-that-must-be-resumed' },
      }),
    )
    expect(response).toMatchObject({
      studentMessage: { id: studentMessageId, sequence: 1 },
      assistantMessage: { id: assistantMessageId, sequence: 2 },
    })
  })

  it('routes retry commands through the same TutoringRuntime entry point', async () => {
    const response = await service.run({
      kind: 'retry',
      courseId,
      sessionId,
      studentId: user.id,
      attemptId,
    })

    expect(retryTurn).toHaveBeenCalledWith({
      courseId,
      sessionId,
      studentId: user.id,
      attemptId,
    })
    expect(response.studentMessage.id).toBe(studentMessageId)
  })

  it('maps active work and non-failed retry targets to distinct audited conflicts', async () => {
    beginTurn.mockResolvedValue({ kind: 'turn_in_progress' })
    await expect(runNew('Question')).rejects.toBeInstanceOf(ConflictException)
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: user.id,
        courseId,
        metadata: { reason: 'TURN_IN_PROGRESS' },
      }),
    )

    retryTurn.mockResolvedValue({
      kind: 'retry_not_allowed',
      attemptId,
    })
    await expect(runRetry()).rejects.toBeInstanceOf(ConflictException)
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: user.id,
        courseId,
        metadata: {
          attemptId,
          reason: 'RETRY_NOT_ALLOWED',
        },
      }),
    )
  })
})

function beginOk(): Extract<BeginTutoringTurnResult, { kind: 'ok' }> {
  return {
    kind: 'ok',
    courseId,
    attemptId,
    studentMessage: studentMessage(),
    assistantMessage: assistantMessage(),
    explanationDetailLevel: ExplanationDetailLevel.STANDARD,
  }
}

function retryOk(): RetryTutoringTurnResult {
  return beginOk()
}

function studentMessage(
  overrides: Partial<ChatMessageRecord> = {},
): ChatMessageRecord {
  return message({
    id: studentMessageId,
    sequence: 1,
    role: MessageRole.STUDENT,
    authorUserId: user.id,
    responseToMessageId: null,
    content: 'Explain list iteration',
    status: MessageStatus.COMPLETED,
    completedAt: new Date('2026-07-21T12:00:00.000Z'),
    ...overrides,
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
    attemptId: null,
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
