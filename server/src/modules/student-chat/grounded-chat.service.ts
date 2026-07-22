import { Inject, Injectable } from '@nestjs/common'

import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import {
  COMPLETION_PROVIDER_TOKEN,
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
  GroundedChatTurnRepository,
  type RetryGroundedChatTurnResult,
} from './grounded-chat-turn.repository'
import type { ChatMessageDto } from './student-chat.dto'
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

export const GROUNDING_BLOCKED_CONTENT =
  'I could not find enough course evidence to answer that question.'
export const GROUNDING_FAILED_CONTENT =
  'I could not generate a grounded response right now. Please retry.'
export const GROUNDING_INSUFFICIENT_EVIDENCE = 'GROUNDING_INSUFFICIENT_EVIDENCE'
export const GROUNDING_RESPONSE_FAILED = 'GROUNDING_RESPONSE_FAILED'

export interface SendGroundedChatMessageInput {
  content: string
}

export interface GroundedChatTurnResponse {
  studentMessage: ChatMessageDto
  assistantMessage: ChatMessageDto
}

interface ActiveGroundedTurn {
  courseId: string
  studentMessage: ChatMessageRecord
  assistantMessage: ChatMessageRecord
}

@Injectable()
export class GroundedChatService {
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
    body: SendGroundedChatMessageInput,
    user: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<GroundedChatTurnResponse> {
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
    } catch {
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

    return this.orchestrate(result, sessionId, user.id)
  }

  async retry(
    courseId: string,
    sessionId: string,
    studentMessageId: string,
    user: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<GroundedChatTurnResponse> {
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
    } catch {
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

    return this.orchestrate(result, sessionId, user.id)
  }

  private async orchestrate(
    turn: ActiveGroundedTurn,
    sessionId: string,
    studentId: string,
  ): Promise<GroundedChatTurnResponse> {
    let evidence: RetrievedChunk[]
    try {
      const retrieval = await this.retrievalService.retrieveCourseEvidence(
        turn.courseId,
        turn.studentMessage.content,
      )
      if (retrieval.kind === 'insufficient_evidence') {
        return await this.persistBlocked(turn, sessionId, studentId)
      }
      evidence = retrieval.chunks
    } catch {
      return this.persistFailure(turn, sessionId, studentId)
    }

    const context = toCompletionContext(evidence)
    if (context === null) {
      return this.persistBlocked(turn, sessionId, studentId)
    }

    let completion: CompletionResult
    try {
      completion = await this.completionProvider.complete({
        studentQuestion: turn.studentMessage.content,
        context,
      })
    } catch {
      return this.persistFailure(turn, sessionId, studentId)
    }

    let completed: FinalizeGroundedChatTurnResult
    try {
      completed = await this.turnRepository.completeTurn({
        courseId: turn.courseId,
        sessionId,
        studentId,
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
    } catch {
      return this.persistFailure(turn, sessionId, studentId)
    }
    if (completed.kind !== 'ok') {
      return this.persistFailure(turn, sessionId, studentId)
    }

    return this.presentTurn(turn.studentMessage, completed.message)
  }

  private async persistBlocked(
    turn: ActiveGroundedTurn,
    sessionId: string,
    studentId: string,
  ): Promise<GroundedChatTurnResponse> {
    try {
      const result = await this.turnRepository.blockTurn({
        courseId: turn.courseId,
        sessionId,
        studentId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: GROUNDING_BLOCKED_CONTENT,
        errorCode: GROUNDING_INSUFFICIENT_EVIDENCE,
      })
      if (result.kind === 'ok') {
        return await this.presentTurn(turn.studentMessage, result.message)
      }
    } catch {
      // The fixed 503 below is the only safe outcome when terminal persistence
      // cannot be trusted. Raw retrieval/database details are never retained.
    }

    throw studentChatTerminalStateUnavailableException()
  }

  private async persistFailure(
    turn: ActiveGroundedTurn,
    sessionId: string,
    studentId: string,
  ): Promise<GroundedChatTurnResponse> {
    try {
      const result = await this.turnRepository.failTurn({
        courseId: turn.courseId,
        sessionId,
        studentId,
        studentMessageId: turn.studentMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        content: GROUNDING_FAILED_CONTENT,
        errorCode: GROUNDING_RESPONSE_FAILED,
      })
      if (result.kind === 'ok') {
        return await this.presentTurn(turn.studentMessage, result.message)
      }
    } catch {
      // See persistBlocked: no raw error crosses or is retained by this seam.
    }

    throw studentChatTerminalStateUnavailableException()
  }

  private async presentTurn(
    studentMessage: ChatMessageRecord,
    assistantMessage: ChatMessageRecord,
  ): Promise<GroundedChatTurnResponse> {
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
    if (result.kind === 'membership_missing') {
      await this.recordDenial({
        courseId,
        sessionId,
        studentId,
        reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
        requestContext,
      })
      throw activeStudentMembershipRequiredException()
    }
    if (result.kind === 'session_not_found') {
      await this.recordDenial({
        courseId,
        sessionId,
        studentId,
        reason: 'DELETED_OR_UNOWNED',
        requestContext,
      })
      throw chatSessionNotFoundException()
    }

    await this.recordDenial({
      courseId,
      sessionId,
      studentId,
      reason: 'TURN_IN_PROGRESS',
      requestContext,
    })
    throw studentChatTurnInProgressException()
  }

  private async handleRetryDenial(
    result: Exclude<RetryGroundedChatTurnResult, { kind: 'ok' }>,
    courseId: string,
    sessionId: string,
    studentId: string,
    studentMessageId: string,
    requestContext?: AuditRequestContext,
  ): Promise<never> {
    if (result.kind === 'membership_missing') {
      await this.recordDenial({
        courseId,
        sessionId,
        studentId,
        reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
        requestContext,
      })
      throw activeStudentMembershipRequiredException()
    }
    if (result.kind === 'session_not_found') {
      await this.recordDenial({
        courseId,
        sessionId,
        studentId,
        reason: 'DELETED_OR_UNOWNED',
        requestContext,
      })
      throw chatSessionNotFoundException()
    }
    if (result.kind === 'message_not_found') {
      await this.recordDenial({
        courseId,
        sessionId,
        studentId,
        messageId: studentMessageId,
        reason: 'RETRY_TARGET_NOT_FOUND',
        requestContext,
      })
      throw studentChatRetryTargetNotFoundException()
    }
    if (result.kind === 'retry_not_allowed') {
      await this.recordDenial({
        courseId,
        sessionId,
        studentId,
        messageId: studentMessageId,
        reason: 'RETRY_NOT_ALLOWED',
        requestContext,
      })
      throw studentChatRetryNotAllowedException()
    }

    await this.recordDenial({
      courseId,
      sessionId,
      studentId,
      reason: 'TURN_IN_PROGRESS',
      requestContext,
    })
    throw studentChatTurnInProgressException()
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
