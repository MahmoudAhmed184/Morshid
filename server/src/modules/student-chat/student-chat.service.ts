import { Injectable, Logger } from '@nestjs/common'

import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import type { AuditRequestContext } from '../audit/audit.service'
import {
  StudentChatAuditService,
  type RecordAccessDeniedInput,
} from './student-chat.audit.service'
import type {
  ChatMessageDto,
  ChatMessageHistoryResponseDto,
  ChatSessionDto,
  ChatSessionListResponseDto,
  ChatSessionResponseDto,
  CreateChatSessionRequest,
  ListChatMessagesQuery,
  ListChatSessionsQuery,
  RenameChatSessionRequest,
} from './student-chat.dto'
import {
  DEFAULT_MESSAGE_PAGE_SIZE,
  DEFAULT_SESSION_PAGE_SIZE,
  MAX_MESSAGE_PAGE_SIZE,
  MAX_SESSION_PAGE_SIZE,
} from './student-chat.dto'
import {
  activeStudentMembershipRequiredException,
  assistantMessageNotFoundException,
  assistantMessageNotPendingException,
  chatSessionNotFoundException,
} from './student-chat.errors'
import { StudentChatMessageRepository } from './student-chat-message.repository'
import { StudentChatSessionRepository } from './student-chat-session.repository'
import type {
  ChatMessageRecord,
  AppendPendingAssistantMessageInput,
  AppendStudentMessageInput,
  BlockAssistantMessageInput,
  CompleteAssistantMessageInput,
  FailAssistantMessageInput,
  MessagePersistenceResult,
  ChatSessionRecord,
} from './student-chat.repository.types'

const DEFAULT_CHAT_TITLE = 'New chat'

@Injectable()
export class StudentChatService {
  private readonly logger = new Logger(StudentChatService.name)

  constructor(
    private readonly sessionRepository: StudentChatSessionRepository,
    private readonly messageRepository: StudentChatMessageRepository,
    private readonly studentChatAuditService: StudentChatAuditService,
  ) {}

  async createSession(
    courseId: string,
    body: CreateChatSessionRequest,
    user: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<ChatSessionResponseDto> {
    await this.requireActiveStudentMembership(courseId, user.id, requestContext)

    const session = await this.sessionRepository.createSession(
      courseId,
      user.id,
      body.title ?? DEFAULT_CHAT_TITLE,
    )

    // A null result means the membership was removed between the guard and the
    // insert (composite FK violation) — treat it as a membership denial, not a
    // 500.
    if (session === null) {
      await this.recordMembershipDenied(courseId, user.id, requestContext)
      throw activeStudentMembershipRequiredException()
    }

    return { session: mapSession(session) }
  }

  async listSessions(
    courseId: string,
    user: AuthenticatedRequestUser,
    query: ListChatSessionsQuery,
    requestContext?: AuditRequestContext,
  ): Promise<ChatSessionListResponseDto> {
    await this.requireActiveStudentMembership(courseId, user.id, requestContext)

    const limit = Math.min(
      query.limit ?? DEFAULT_SESSION_PAGE_SIZE,
      MAX_SESSION_PAGE_SIZE,
    )
    const sessions = await this.sessionRepository.listSessions(
      courseId,
      user.id,
      { limit, cursor: query.cursor ?? null },
    )

    return {
      sessions: sessions.map(mapSession),
      nextCursor:
        sessions.length === limit
          ? (sessions[sessions.length - 1]?.id ?? null)
          : null,
    }
  }

  async getSession(
    courseId: string,
    sessionId: string,
    user: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<ChatSessionResponseDto> {
    const session = await this.requireOwnedActiveSession(
      courseId,
      sessionId,
      user.id,
      requestContext,
    )

    return { session: mapSession(session) }
  }

  async renameSession(
    courseId: string,
    sessionId: string,
    body: RenameChatSessionRequest,
    user: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<ChatSessionResponseDto> {
    await this.requireActiveStudentMembership(courseId, user.id, requestContext)

    const session = await this.sessionRepository.renameSession(
      courseId,
      sessionId,
      user.id,
      body.title,
    )

    if (session === null) {
      await this.recordSessionAccessDenied(
        courseId,
        user.id,
        sessionId,
        requestContext,
      )
      throw chatSessionNotFoundException()
    }

    return { session: mapSession(session) }
  }

  async softDeleteSession(
    courseId: string,
    sessionId: string,
    user: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<void> {
    await this.requireActiveStudentMembership(courseId, user.id, requestContext)

    const outcome = await this.sessionRepository.softDeleteSession({
      courseId,
      sessionId,
      studentId: user.id,
      requestContext,
    })

    // Deleting a session you own that is already deleted is idempotent success
    // (204) — it must not emit a spurious access-denied audit row nor a 404.
    if (outcome === 'not_found') {
      await this.recordSessionAccessDenied(
        courseId,
        user.id,
        sessionId,
        requestContext,
      )
      throw chatSessionNotFoundException()
    }
  }

  async listMessages(
    courseId: string,
    sessionId: string,
    user: AuthenticatedRequestUser,
    query: ListChatMessagesQuery,
    requestContext?: AuditRequestContext,
  ): Promise<ChatMessageHistoryResponseDto> {
    await this.requireActiveStudentMembership(courseId, user.id, requestContext)

    const limit = Math.min(
      query.limit ?? DEFAULT_MESSAGE_PAGE_SIZE,
      MAX_MESSAGE_PAGE_SIZE,
    )
    const messages = await this.messageRepository.listMessages(
      courseId,
      sessionId,
      user.id,
      { limit, after: query.after ?? null },
    )

    if (messages === null) {
      await this.recordSessionAccessDenied(
        courseId,
        user.id,
        sessionId,
        requestContext,
      )
      throw chatSessionNotFoundException()
    }

    return {
      messages: messages.map(mapMessage),
      nextCursor:
        messages.length === limit
          ? (messages[messages.length - 1]?.sequence ?? null)
          : null,
    }
  }

  appendStudentMessage(
    input: AppendStudentChatMessageInput,
    requestContext?: AuditRequestContext,
  ): Promise<ChatMessageDto> {
    return this.mapPersistenceResult(
      input.courseId,
      input.sessionId,
      input.studentId,
      requestContext,
      this.messageRepository.appendStudentMessage(input),
    )
  }

  appendPendingAssistantMessage(
    input: AppendPendingAssistantChatMessageInput,
    requestContext?: AuditRequestContext,
  ): Promise<ChatMessageDto> {
    return this.mapPersistenceResult(
      input.courseId,
      input.sessionId,
      input.studentId,
      requestContext,
      this.messageRepository.appendPendingAssistantMessage(input),
    )
  }

  completeAssistantMessage(
    input: CompleteAssistantChatMessageInput,
    requestContext?: AuditRequestContext,
  ): Promise<ChatMessageDto> {
    return this.mapPersistenceResult(
      input.courseId,
      input.sessionId,
      input.studentId,
      requestContext,
      this.messageRepository.completeAssistantMessage(input),
    )
  }

  failAssistantMessage(
    input: FailAssistantChatMessageInput,
    requestContext?: AuditRequestContext,
  ): Promise<ChatMessageDto> {
    return this.mapPersistenceResult(
      input.courseId,
      input.sessionId,
      input.studentId,
      requestContext,
      this.messageRepository.failAssistantMessage(input),
    )
  }

  blockAssistantMessage(
    input: BlockAssistantChatMessageInput,
    requestContext?: AuditRequestContext,
  ): Promise<ChatMessageDto> {
    return this.mapPersistenceResult(
      input.courseId,
      input.sessionId,
      input.studentId,
      requestContext,
      this.messageRepository.blockAssistantMessage(input),
    )
  }

  /**
   * Records a role-guard denial (a non-Student reaching a Student-only chat
   * endpoint). The global `RolesGuard` rejects the request before any handler
   * runs, so this is invoked from a chat-scoped exception filter to keep role
   * denials audited alongside membership/ownership denials. Like every deny
   * path here it is best-effort and FK-safe: it never converts the 403 into a
   * 500 and never stores an unverified course id in the FK column.
   */
  async recordRoleAccessDenied(
    courseId: string | null,
    actorUserId: string | null,
    requestContext?: AuditRequestContext,
  ): Promise<void> {
    if (actorUserId === null) {
      return
    }

    const courseExists =
      courseId !== null && (await this.courseExistsSafe(courseId))

    await this.recordAccessDenied({
      actorUserId,
      courseId: courseExists ? courseId : null,
      unverifiedCourseId: courseExists ? null : courseId,
      reason: 'INSUFFICIENT_ROLE',
      requestContext,
    })
  }

  private async requireActiveStudentMembership(
    courseId: string,
    studentId: string,
    requestContext?: AuditRequestContext,
  ): Promise<void> {
    const hasMembership =
      await this.sessionRepository.hasActiveStudentMembership(
        courseId,
        studentId,
      )

    if (!hasMembership) {
      await this.recordMembershipDenied(courseId, studentId, requestContext)
      throw activeStudentMembershipRequiredException()
    }
  }

  /**
   * Records a membership access-denied audit event without ever converting the
   * intended 403 into a 500:
   *  - the raw `courseId` may reference a non-existent course, which would
   *    violate the `audit_logs.course_id` FK, so it is only stored in the FK
   *    column when the course is confirmed to exist (otherwise kept in
   *    unconstrained JSONB metadata); this also removes a course-existence
   *    oracle for students.
   *  - the write itself is best-effort so a transient audit failure never
   *    replaces the domain response.
   */
  private async recordMembershipDenied(
    courseId: string,
    studentId: string,
    requestContext?: AuditRequestContext,
  ): Promise<void> {
    const courseExists = await this.courseExistsSafe(courseId)

    await this.recordAccessDenied({
      actorUserId: studentId,
      courseId: courseExists ? courseId : null,
      unverifiedCourseId: courseExists ? null : courseId,
      reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
      requestContext,
    })
  }

  private async courseExistsSafe(courseId: string): Promise<boolean> {
    try {
      return await this.sessionRepository.courseExists(courseId)
    } catch (error) {
      this.logger.error(
        'Failed to resolve course existence for student chat audit',
        error instanceof Error ? error.stack : undefined,
      )

      return false
    }
  }

  private async recordAccessDenied(
    input: RecordAccessDeniedInput,
  ): Promise<void> {
    try {
      await this.studentChatAuditService.recordAccessDenied(input)
    } catch (error) {
      // Deny-path audit writes must never turn a correct 403/404 into a 500.
      this.logger.error(
        'Failed to record student chat access-denied audit event',
        error instanceof Error ? error.stack : undefined,
      )
    }
  }

  private async requireOwnedActiveSession(
    courseId: string,
    sessionId: string,
    studentId: string,
    requestContext?: AuditRequestContext,
  ): Promise<ChatSessionRecord> {
    await this.requireActiveStudentMembership(
      courseId,
      studentId,
      requestContext,
    )

    const session = await this.sessionRepository.findOwnedActiveSession(
      courseId,
      sessionId,
      studentId,
    )

    if (session === null) {
      await this.recordSessionAccessDenied(
        courseId,
        studentId,
        sessionId,
        requestContext,
      )
      throw chatSessionNotFoundException()
    }

    return session
  }

  private recordSessionAccessDenied(
    courseId: string,
    studentId: string,
    sessionId: string,
    requestContext?: AuditRequestContext,
  ): Promise<void> {
    // Reached only after an active membership was confirmed, so the course is
    // known to exist and `courseId` is safe for the FK column.
    return this.recordAccessDenied({
      actorUserId: studentId,
      courseId,
      sessionId,
      reason: 'DELETED_OR_UNOWNED',
      requestContext,
    })
  }

  private async mapPersistenceResult(
    courseId: string,
    sessionId: string,
    studentId: string,
    requestContext: AuditRequestContext | undefined,
    resultPromise: Promise<MessagePersistenceResult>,
  ): Promise<ChatMessageDto> {
    const result = await resultPromise

    if (result.kind === 'ok') {
      return mapMessage(result.message)
    }

    if (result.kind === 'membership_missing') {
      await this.recordMembershipDenied(courseId, studentId, requestContext)
      throw activeStudentMembershipRequiredException()
    }

    if (result.kind === 'message_not_found') {
      await this.recordAccessDenied({
        actorUserId: studentId,
        courseId,
        sessionId,
        reason: 'ASSISTANT_MESSAGE_NOT_FOUND',
        messageId: result.messageId,
        requestContext,
      })
      throw assistantMessageNotFoundException()
    }

    if (result.kind === 'message_not_pending') {
      await this.recordAccessDenied({
        actorUserId: studentId,
        courseId,
        sessionId,
        reason: 'ASSISTANT_MESSAGE_NOT_PENDING',
        messageId: result.messageId,
        requestContext,
      })
      throw assistantMessageNotPendingException()
    }

    await this.recordSessionAccessDenied(
      courseId,
      studentId,
      sessionId,
      requestContext,
    )
    throw chatSessionNotFoundException()
  }
}

export interface AppendStudentChatMessageInput extends AppendStudentMessageInput {
  status?: never
  role?: never
  provider?: never
  model?: never
  citations?: never
}

export interface AppendPendingAssistantChatMessageInput extends AppendPendingAssistantMessageInput {
  status?: never
  role?: never
  provider?: never
  model?: never
  citations?: never
}

export interface CompleteAssistantChatMessageInput extends CompleteAssistantMessageInput {
  status?: never
  role?: never
  citations?: never
}

export interface FailAssistantChatMessageInput extends FailAssistantMessageInput {
  status?: never
  role?: never
  provider?: never
  model?: never
  citations?: never
}

export interface BlockAssistantChatMessageInput extends BlockAssistantMessageInput {
  status?: never
  role?: never
  provider?: never
  model?: never
  citations?: never
}

function mapSession(record: ChatSessionRecord): ChatSessionDto {
  return {
    id: record.id,
    courseId: record.courseId,
    title: record.title,
    lastMessageAt: record.lastMessageAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function mapMessage(record: ChatMessageRecord): ChatMessageDto {
  return {
    id: record.id,
    sequence: record.sequence,
    role: record.role,
    responseToMessageId: record.responseToMessageId,
    content: record.content,
    status: record.status,
    requestKind: record.requestKind,
    guidanceLabel: record.guidanceLabel,
    hintLevel: record.hintLevel,
    errorCode: record.errorCode,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
  }
}
