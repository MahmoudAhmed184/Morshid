import { randomUUID } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'

import { Prisma } from '../../generated/prisma/client'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import type { AuditRequestContext } from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import {
  type BeginGroundedChatTurnResult,
  type FinalizeGroundedChatTurnResult,
  GroundedChatEvidenceUnavailableError,
  GroundedChatTurnRepository,
  type RetryGroundedChatTurnResult,
} from './grounded-chat-turn.repository'
import { SocraticChatOrchestrator } from './socratic-chat.orchestrator'
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
import { chatMessageSelect } from './student-chat.repository.support'
import { StudentChatService } from './student-chat.service'
import {
  GROUNDING_BLOCKED_CONTENT,
  GROUNDING_INSUFFICIENT_EVIDENCE,
  GROUNDING_FAILED_CONTENT,
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
  | 'socratic_orchestration'
  | 'blocked_persistence'
  | 'failed_persistence'

type TerminalPersistence =
  | {
      kind: 'blocked'
      phase: 'blocked_persistence'
      content: string
      errorCode: string
    }
  | {
      kind: 'failed'
      phase: 'failed_persistence'
      content: string
      errorCode: string
    }

@Injectable()
export class GroundedChatService {
  private readonly logger = new Logger(GroundedChatService.name)

  constructor(
    private readonly studentChatService: StudentChatService,
    private readonly turnRepository: GroundedChatTurnRepository,
    private readonly messagePresenter: StudentChatMessagePresenter,
    private readonly socraticOrchestrator: SocraticChatOrchestrator,
    private readonly prismaService: PrismaService,
  ) {}

  async send(
    courseId: string,
    sessionId: string,
    body: SendStudentChatMessageRequest,
    user: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<GroundedChatTurnResponseDto> {
    const operation: OrchestrationContext = {
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
        ...(body.clientMessageId === undefined
          ? {}
          : { clientMessageId: body.clientMessageId }),
        content: body.content,
      })
    } catch (error) {
      this.logFailure('begin', operation, error)
      throw studentChatTerminalStateUnavailableException()
    }
    if (result.kind === 'replayed') {
      return this.presentTurn(result.studentMessage, result.assistantMessage)
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

    return this.orchestrate(
      result,
      {
        ...operation,
        studentMessageId: result.studentMessage.id,
        assistantMessageId: result.assistantMessage.id,
      },
      result.studentMessage.id,
    )
  }

  async retry(
    courseId: string,
    sessionId: string,
    studentMessageId: string,
    user: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<GroundedChatTurnResponseDto> {
    const operation: OrchestrationContext = {
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

    return this.orchestrate(
      result,
      {
        ...operation,
        assistantMessageId: result.assistantMessage.id,
      },
      `${result.studentMessage.id}:${result.attemptId}`,
    )
  }

  private async orchestrate(
    turn: ActiveGroundedTurn,
    operation: OrchestrationContext,
    idempotencyKey: string,
  ): Promise<GroundedChatTurnResponseDto> {
    let orchestratorResult
    try {
      orchestratorResult = await this.socraticOrchestrator.orchestrate({
        courseId: turn.courseId,
        sessionId: operation.sessionId,
        studentId: operation.studentId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        studentMessageContent: turn.studentMessage.content,
        idempotencyKey,
      })
    } catch (error) {
      this.logFailure('socratic_orchestration', operation, error)
      return this.persistFailure(turn, operation)
    }

    switch (orchestratorResult.kind) {
      case 'completed':
        return this.presentTurn(
          orchestratorResult.studentMessage,
          orchestratorResult.assistantMessage,
        )
      case 'blocked':
        return this.persistBlocked(turn, operation)
      case 'failed':
        return this.persistFailure(turn, operation)
    }
  }

  private async persistBlocked(
    turn: ActiveGroundedTurn,
    operation: OrchestrationContext,
  ): Promise<GroundedChatTurnResponseDto> {
    return this.persistTerminal(turn, operation, {
      kind: 'blocked',
      phase: 'blocked_persistence',
      content: GROUNDING_BLOCKED_CONTENT,
      errorCode: GROUNDING_INSUFFICIENT_EVIDENCE,
    })
  }

  private async persistFailure(
    turn: ActiveGroundedTurn,
    operation: OrchestrationContext,
  ): Promise<GroundedChatTurnResponseDto> {
    return this.persistTerminal(turn, operation, {
      kind: 'failed',
      phase: 'failed_persistence',
      content: GROUNDING_FAILED_CONTENT,
      errorCode: GROUNDING_RESPONSE_FAILED,
    })
  }

  private async persistTerminal(
    turn: ActiveGroundedTurn,
    operation: OrchestrationContext,
    terminal: TerminalPersistence,
  ): Promise<GroundedChatTurnResponseDto> {
    try {
      const input = {
        courseId: turn.courseId,
        sessionId: operation.sessionId,
        studentId: operation.studentId,
        attemptId: turn.attemptId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: terminal.content,
        errorCode: terminal.errorCode,
      }
      let result: FinalizeGroundedChatTurnResult
      switch (terminal.kind) {
        case 'blocked':
          result = await this.turnRepository.blockTurn(input)
          break
        case 'failed':
          result = await this.turnRepository.failTurn(input)
          break
        default:
          return assertNever(terminal)
      }

      switch (result.kind) {
        case 'ok':
          return await this.presentTurn(
            await this.reloadStudentMessage(turn.studentMessage),
            result.message,
          )
        case 'membership_missing':
        case 'session_not_found':
        case 'message_not_found':
        case 'message_not_pending':
          this.logResultFailure(terminal.phase, operation, result.kind)
          break
        default:
          return assertNever(result)
      }
    } catch (error) {
      this.logFailure(terminal.phase, operation, error)
    }

    if (terminal.kind === 'blocked') {
      return this.persistFailure(turn, operation)
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

  private async reloadStudentMessage(
    fallback: ChatMessageRecord,
  ): Promise<ChatMessageRecord> {
    try {
      return (
        (await this.prismaService.message.findUnique({
          where: { id: fallback.id },
          select: chatMessageSelect,
        })) ?? fallback
      )
    } catch (error) {
      this.logger.warn({
        event: 'student_message_metadata_reload_failed',
        messageId: fallback.id,
        ...safeErrorDescriptor(error),
      })
      return fallback
    }
  }

  private async handleBeginDenial(
    result: Exclude<
      BeginGroundedChatTurnResult,
      { kind: 'ok' } | { kind: 'replayed' }
    >,
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

function safeErrorDescriptor(error: unknown): {
  errorClass: string
  errorCode?: string
} {
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
