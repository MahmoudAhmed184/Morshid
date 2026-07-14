import { Injectable } from '@nestjs/common'

import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import type { AuditRequestContext } from '../audit/audit.service'
import { StudentChatAuditService } from './student-chat.audit.service'
import type {
  ChatSessionDto,
  ChatSessionListResponseDto,
  ChatSessionResponseDto,
  CreateChatSessionRequest,
} from './student-chat.dto'
import { activeStudentMembershipRequiredException } from './student-chat.errors'
import {
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
