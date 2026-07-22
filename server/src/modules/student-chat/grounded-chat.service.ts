import { randomUUID } from 'node:crypto'

import { Inject, Injectable, Logger } from '@nestjs/common'

import { Prisma } from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import {
  COMPLETION_PROVIDER_TOKEN,
  CompletionProviderError,
  type CompletionProvider,
  type CompletionResult,
  type NonEmptyCompletionContext,
} from '../completion/completion-provider'
import type { AuditRequestContext } from '../audit/audit.service'
import {
  RetrievalService,
  type RetrievedChunk,
} from '../retrieval/retrieval.service'
import {
  type BeginGroundedChatTurnResult,
  type FinalizeGroundedChatTurnResult,
  GroundedChatEvidenceUnavailableError,
  GroundedChatTurnRepository,
  type RetryGroundedChatTurnResult,
} from './grounded-chat-turn.repository'
import type {
  GroundedChatTurnResponseDto,
  SendStudentChatMessageRequest,
} from './student-chat.dto'
import {
  activeStudentMembershipRequiredException,
  chatSessionNotFoundException,
  studentChatRetryNotAllowedException,
  studentChatRetryTargetNotFoundException,
  studentChatTerminalStateUnavailableException,
  studentChatTurnInProgressException,
} from './student-chat.errors'
import { StudentChatMessagePresenter } from './student-chat-message.presenter'
import type { ChatMessageRecord } from './student-chat.repository.types'
import { StudentChatService } from './student-chat.service'
import {
  GROUNDING_BLOCKED_CONTENT,
  GROUNDING_FAILED_CONTENT,
  GROUNDING_INSUFFICIENT_EVIDENCE,
  GROUNDING_RESPONSE_FAILED,
} from './grounded-chat.constants'

export {
  GROUNDING_BLOCKED_CONTENT,
  GROUNDING_FAILED_CONTENT,
} from './grounded-chat.constants'

interface ActiveGroundedTurn {
  courseId: string
  attemptId: string
  studentMessage: ChatMessageRecord
  assistantMessage: ChatMessageRecord
}

interface OrchestrationContext {
  operationId: string
  courseId: string
  sessionId: string
  studentId: string
  studentMessageId?: string
  assistantMessageId?: string
}

type OrchestrationPhase =
  | 'begin'
  | 'retry'
  | 'retrieval'
  | 'completion'
  | 'finalization'
  | 'blocked_persistence'
  | 'failed_persistence'

@Injectable()
export class GroundedChatService {
  private readonly logger = new Logger(GroundedChatService.name)

  constructor(
    private readonly studentChatService: StudentChatService,
    private readonly turnRepository: GroundedChatTurnRepository,
    private readonly retrievalService: RetrievalService,
    @Inject(COMPLETION_PROVIDER_TOKEN)
    private readonly completionProvider: CompletionProvider,
    private readonly messagePresenter: StudentChatMessagePresenter,
  ) {}

  async send(
    courseId: string,
    sessionId: string,
    body: SendStudentChatMessageRequest,
    user: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<GroundedChatTurnResponseDto> {
    const operation = {
      operationId: randomUUID(),
      courseId,
      sessionId,
      studentId: user.id,
    }
    await this.studentChatService.getSession(
      courseId,
      sessionId,
      user,
      requestContext,
    )

    let result: BeginGroundedChatTurnResult
    try {
      result = await this.turnRepository.beginTurn({
        courseId,
        sessionId,
        studentId: user.id,
        content: body.content,
      })
    } catch (error) {
      this.logFailure('begin', operation, error)
      throw studentChatTerminalStateUnavailableException()
    }
    if (result.kind !== 'ok') {
      return this.handleBeginDenial(
        result,
        courseId,
        sessionId,
        user.id,
        requestContext,
      )
    }

    return this.orchestrate(result, {
      ...operation,
      studentMessageId: result.studentMessage.id,
      assistantMessageId: result.assistantMessage.id,
    })
  }

  async retry(
    courseId: string,
    sessionId: string,
    studentMessageId: string,
    user: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<GroundedChatTurnResponseDto> {
    const operation = {
      operationId: randomUUID(),
      courseId,
      sessionId,
      studentId: user.id,
      studentMessageId,
    }
    await this.studentChatService.getSession(
      courseId,
      sessionId,
      user,
      requestContext,
    )

    let result: RetryGroundedChatTurnResult
    try {
      result = await this.turnRepository.retryTurn({
        courseId,
        sessionId,
        studentId: user.id,
        studentMessageId,
      })
    } catch (error) {
      this.logFailure('retry', operation, error)
      throw studentChatTerminalStateUnavailableException()
    }
    if (result.kind !== 'ok') {
      return this.handleRetryDenial(
        result,
        courseId,
        sessionId,
        user.id,
        studentMessageId,
        requestContext,
      )
    }

    return this.orchestrate(result, {
      ...operation,
      assistantMessageId: result.assistantMessage.id,
    })
  }

  private async orchestrate(
    turn: ActiveGroundedTurn,
    operation: OrchestrationContext,
  ): Promise<GroundedChatTurnResponseDto> {
    let evidence: RetrievedChunk[]
    try {
      const retrieval = await this.retrievalService.retrieveCourseEvidence(
        turn.courseId,
        turn.studentMessage.content,
      )
      if (retrieval.kind === 'insufficient_evidence') {
        return await this.persistBlocked(turn, operation)
      }
      evidence = retrieval.chunks
    } catch (error) {
      this.logFailure('retrieval', operation, error)
      return this.persistFailure(turn, operation)
    }

    const context = toCompletionContext(evidence)
    if (context === null) {
      return this.persistBlocked(turn, operation)
    }

    let completion: CompletionResult
    try {
      completion = await this.completionProvider.complete({
        studentQuestion: turn.studentMessage.content,
        context,
      })
    } catch (error) {
      this.logFailure('completion', operation, error)
      return this.persistFailure(turn, operation)
    }

    let completed: FinalizeGroundedChatTurnResult
    try {
      completed = await this.turnRepository.completeTurn({
        courseId: turn.courseId,
        sessionId: operation.sessionId,
        studentId: operation.studentId,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: completion.content,
        provider: completion.provider,
        model: completion.model,
        promptVersion: completion.promptVersion,
        ...(completion.inputTokens === undefined
          ? {}
          : { inputTokens: completion.inputTokens }),
        ...(completion.outputTokens === undefined
          ? {}
          : { outputTokens: completion.outputTokens }),
        evidence,
      })
    } catch (error) {
      this.logFailure('finalization', operation, error)
      return this.persistFailure(turn, operation)
    }
    switch (completed.kind) {
      case 'ok':
        return this.presentTurn(turn.studentMessage, completed.message)
      case 'membership_missing':
      case 'session_not_found':
      case 'message_not_found':
      case 'message_not_pending':
        this.logResultFailure('finalization', operation, completed.kind)
        return this.persistFailure(turn, operation)
      default:
        return assertNever(completed)
    }
  }

  private async persistBlocked(
    turn: ActiveGroundedTurn,
    operation: OrchestrationContext,
  ): Promise<GroundedChatTurnResponseDto> {
    try {
      const result = await this.turnRepository.blockTurn({
        courseId: turn.courseId,
        sessionId: operation.sessionId,
        studentId: operation.studentId,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: GROUNDING_BLOCKED_CONTENT,
        errorCode: GROUNDING_INSUFFICIENT_EVIDENCE,
      })
      switch (result.kind) {
        case 'ok':
          return await this.presentTurn(turn.studentMessage, result.message)
        case 'membership_missing':
        case 'session_not_found':
        case 'message_not_found':
        case 'message_not_pending':
          this.logResultFailure('blocked_persistence', operation, result.kind)
          return await this.persistFailure(turn, operation)
        default:
          return assertNever(result)
      }
    } catch (error) {
      this.logFailure('blocked_persistence', operation, error)
      return await this.persistFailure(turn, operation)
    }
  }

  private async persistFailure(
    turn: ActiveGroundedTurn,
    operation: OrchestrationContext,
  ): Promise<GroundedChatTurnResponseDto> {
    try {
      const result = await this.turnRepository.failTurn({
        courseId: turn.courseId,
        sessionId: operation.sessionId,
        studentId: operation.studentId,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: GROUNDING_FAILED_CONTENT,
        errorCode: GROUNDING_RESPONSE_FAILED,
      })
      switch (result.kind) {
        case 'ok':
          return await this.presentTurn(turn.studentMessage, result.message)
        case 'membership_missing':
        case 'session_not_found':
        case 'message_not_found':
        case 'message_not_pending':
          this.logResultFailure('failed_persistence', operation, result.kind)
          break
        default:
          return assertNever(result)
      }
    } catch (error) {
      this.logFailure('failed_persistence', operation, error)
    }

    throw studentChatTerminalStateUnavailableException()
  }

  private async presentTurn(
    studentMessage: ChatMessageRecord,
    assistantMessage: ChatMessageRecord,
  ): Promise<GroundedChatTurnResponseDto> {
    const [presentedStudent, presentedAssistant] =
      await this.messagePresenter.presentMany([
        studentMessage,
        assistantMessage,
      ])
    return {
      studentMessage: presentedStudent,
      assistantMessage: presentedAssistant,
    }
  }

  private async handleBeginDenial(
    result: Exclude<BeginGroundedChatTurnResult, { kind: 'ok' }>,
    courseId: string,
    sessionId: string,
    studentId: string,
    requestContext?: AuditRequestContext,
  ): Promise<never> {
    switch (result.kind) {
      case 'membership_missing':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
          requestContext,
        })
        throw activeStudentMembershipRequiredException()
      case 'session_not_found':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'DELETED_OR_UNOWNED',
          requestContext,
        })
        throw chatSessionNotFoundException()
      case 'turn_in_progress':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'TURN_IN_PROGRESS',
          requestContext,
        })
        throw studentChatTurnInProgressException()
      default:
        return assertNever(result)
    }
  }

  private async handleRetryDenial(
    result: Exclude<RetryGroundedChatTurnResult, { kind: 'ok' }>,
    courseId: string,
    sessionId: string,
    studentId: string,
    studentMessageId: string,
    requestContext?: AuditRequestContext,
  ): Promise<never> {
    switch (result.kind) {
      case 'membership_missing':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
          requestContext,
        })
        throw activeStudentMembershipRequiredException()
      case 'session_not_found':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'DELETED_OR_UNOWNED',
          requestContext,
        })
        throw chatSessionNotFoundException()
      case 'message_not_found':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          messageId: studentMessageId,
          reason: 'RETRY_TARGET_NOT_FOUND',
          requestContext,
        })
        throw studentChatRetryTargetNotFoundException()
      case 'retry_not_allowed':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          messageId: studentMessageId,
          reason: 'RETRY_NOT_ALLOWED',
          requestContext,
        })
        throw studentChatRetryNotAllowedException()
      case 'turn_in_progress':
        await this.recordDenial({
          courseId,
          sessionId,
          studentId,
          reason: 'TURN_IN_PROGRESS',
          requestContext,
        })
        throw studentChatTurnInProgressException()
      default:
        return assertNever(result)
    }
  }

  private logFailure(
    phase: OrchestrationPhase,
    operation: OrchestrationContext,
    error: unknown,
  ): void {
    this.logger.warn({
      event: 'grounded_chat_phase_failed',
      phase,
      ...safeErrorDescriptor(error),
      ...operation,
    })
  }

  private logResultFailure(
    phase: OrchestrationPhase,
    operation: OrchestrationContext,
    resultKind: Exclude<FinalizeGroundedChatTurnResult['kind'], 'ok'>,
  ): void {
    this.logger.warn({
      event: 'grounded_chat_phase_failed',
      phase,
      errorClass: 'RepositoryResult',
      errorCode: resultKind,
      ...operation,
    })
  }

  private recordDenial(
    input: Parameters<StudentChatService['recordGroundedTurnDenied']>[0],
  ): Promise<void> {
    return this.studentChatService.recordGroundedTurnDenied(input)
  }
}

function toCompletionContext(
  chunks: readonly RetrievedChunk[],
): NonEmptyCompletionContext | null {
  const first = chunks.at(0)
  if (first === undefined) {
    return null
  }

  return [toContextEntry(first), ...chunks.slice(1).map(toContextEntry)]
}

function toContextEntry(chunk: RetrievedChunk) {
  return {
    sourceTitle: chunk.materialTitle,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
  }
}

function safeErrorDescriptor(error: unknown): {
  errorClass: string
  errorCode?: string
} {
  if (error instanceof CompletionProviderError) {
    return {
      errorClass: 'CompletionProviderError',
      errorCode: error.code,
    }
  }
  if (error instanceof GroundedChatEvidenceUnavailableError) {
    return { errorClass: 'GroundedChatEvidenceUnavailableError' }
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      errorClass: 'PrismaClientKnownRequestError',
      ...(isSafePrismaCode(error.code) ? { errorCode: error.code } : {}),
    }
  }
  if (error instanceof TypeError) {
    return { errorClass: 'TypeError' }
  }
  if (error instanceof Error) {
    return { errorClass: 'Error' }
  }

  return { errorClass: 'UnknownError' }
}

function isSafePrismaCode(code: string): boolean {
  return /^P\d{4}$/u.test(code)
}

function assertNever(_value: never): never {
  throw new Error('Unhandled grounded chat result')
}
