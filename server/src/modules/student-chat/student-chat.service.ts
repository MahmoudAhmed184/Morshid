import { Injectable } from '@nestjs/common'

import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import type { AuditRequestContext } from '../audit/audit.service'
import { StudentChatAuditService } from './student-chat.audit.service'
import type {
  ChatMessageDto,
  ChatMessageHistoryResponseDto,
  ChatSessionDto,
  ChatSessionListResponseDto,
  ChatSessionResponseDto,
  CreateChatSessionRequest,
  RenameChatSessionRequest,
} from './student-chat.dto'
import {
  activeStudentMembershipRequiredException,
  chatSessionNotFoundException,
} from './student-chat.errors'
import {
  type ChatMessageRecord,
  type ChatSessionRecord,
  StudentChatRepository,
} from './student-chat.repository'

const DEFAULT_CHAT_TITLE = 'New chat'

@Injectable()
export class StudentChatService {
  constructor(
    private readonly studentChatRepository: StudentChatRepository,
    private readonly studentChatAuditService: StudentChatAuditService,
  ) {}

  async createSession(
    courseId: string,
    body: CreateChatSessionRequest,
    user: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<ChatSessionResponseDto> {
    await this.requireActiveStudentMembership(courseId, user.id, requestContext)

    const session = await this.studentChatRepository.createSession(
      courseId,
      user.id,
      body.title ?? DEFAULT_CHAT_TITLE,
    )

    return { session: mapSession(session) }
  }

  async listSessions(
    courseId: string,
    user: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<ChatSessionListResponseDto> {
    await this.requireActiveStudentMembership(courseId, user.id, requestContext)

    const sessions = await this.studentChatRepository.listSessions(
      courseId,
      user.id,
    )

    return { sessions: sessions.map(mapSession) }
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

    const session = await this.studentChatRepository.renameSession(
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

    const deleted = await this.studentChatRepository.softDeleteSession({
      courseId,
      sessionId,
      studentId: user.id,
      requestContext,
    })

    if (!deleted) {
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
    requestContext?: AuditRequestContext,
  ): Promise<ChatMessageHistoryResponseDto> {
    await this.requireActiveStudentMembership(courseId, user.id, requestContext)

    const messages = await this.studentChatRepository.listMessages(
      courseId,
      sessionId,
      user.id,
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

    return { messages: messages.map(mapMessage) }
  }

  private async requireActiveStudentMembership(
    courseId: string,
    studentId: string,
    requestContext?: AuditRequestContext,
  ): Promise<void> {
    const hasMembership =
      await this.studentChatRepository.hasActiveStudentMembership(
        courseId,
        studentId,
      )

    if (!hasMembership) {
      await this.studentChatAuditService.recordAccessDenied({
        actorUserId: studentId,
        courseId,
        reason: 'ACTIVE_STUDENT_MEMBERSHIP_REQUIRED',
        requestContext,
      })
      throw activeStudentMembershipRequiredException()
    }
  }

  private async requireOwnedActiveSession(
    courseId: string,
    sessionId: string,
    studentId: string,
    requestContext?: AuditRequestContext,
  ): Promise<ChatSessionRecord> {
    await this.requireActiveStudentMembership(courseId, studentId, requestContext)

    const session = await this.studentChatRepository.findOwnedActiveSession(
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
    return this.studentChatAuditService.recordAccessDenied({
      actorUserId: studentId,
      courseId,
      sessionId,
      reason: 'DELETED_OR_UNOWNED',
      requestContext,
    })
  }
}

function mapSession(record: ChatSessionRecord): ChatSessionDto {
  return {
    id: record.id,
    courseId: record.courseId,
    title: record.title,
    lastSequence: record.lastSequence,
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
    authorUserId: record.authorUserId,
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
