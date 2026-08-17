import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  MessageRole,
  MessageStatus,
  Prisma,
} from '../../generated/prisma/client'
import { PrismaService } from '../../platform/database/prisma.service'
import { asDatabaseTransaction } from '../../platform/database/database-transaction'
import { ConversationAuditService } from './conversation-audit.service'
import {
  chatSessionSelect,
  ownedActiveSessionWhere,
} from './conversation-repository.support'
import type {
  ChatSessionRecord,
  ExportableMessageRecord,
  ExportableSessionRecord,
  SessionListPagination,
  SoftDeleteChatSessionInput,
  SoftDeleteSessionOutcome,
} from './interface/conversation-records'

export abstract class ConversationSessionRepository {
  abstract hasActiveStudentMembership(
    courseId: string,
    studentId: string,
  ): Promise<boolean>

  abstract hasActiveOrArchivedStudentAccess(
    courseId: string,
    studentId: string,
  ): Promise<boolean>

  abstract courseExists(courseId: string): Promise<boolean>

  abstract createSession(
    courseId: string,
    studentId: string,
    title: string,
  ): Promise<ChatSessionRecord | null>

  abstract listSessions(
    courseId: string,
    studentId: string,
    pagination: SessionListPagination,
  ): Promise<ChatSessionRecord[]>

  abstract findOwnedActiveSession(
    courseId: string,
    sessionId: string,
    studentId: string,
  ): Promise<ChatSessionRecord | null>

  abstract findExportableSession(
    courseId: string,
    sessionId: string,
    studentId: string,
  ): Promise<ExportableSessionRecord | null>

  abstract listMessagesForExport(
    sessionId: string,
    cursor?: number,
    limit?: number,
  ): Promise<ExportableMessageRecord[]>

  abstract renameSession(
    courseId: string,
    sessionId: string,
    studentId: string,
    title: string,
  ): Promise<ChatSessionRecord | null>

  abstract softDeleteSession(
    input: SoftDeleteChatSessionInput,
  ): Promise<SoftDeleteSessionOutcome>
}

@Injectable()
export class PrismaConversationSessionRepository extends ConversationSessionRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly conversationAuditService: ConversationAuditService,
  ) {
    super()
  }

  async hasActiveStudentMembership(
    courseId: string,
    studentId: string,
  ): Promise<boolean> {
    const membership = await this.prismaService.courseMembership.findFirst({
      where: {
        courseId,
        userId: studentId,
        role: CourseMembershipRole.STUDENT,
        removedAt: null,
      },
      select: {
        id: true,
      },
    })

    return membership !== null
  }

  async hasActiveOrArchivedStudentAccess(
    courseId: string,
    studentId: string,
  ): Promise<boolean> {
    const membership = await this.prismaService.courseMembership.findFirst({
      where: {
        courseId,
        userId: studentId,
        role: CourseMembershipRole.STUDENT,
      },
      select: {
        removedAt: true,
        course: {
          select: {
            archivedAt: true,
          },
        },
      },
    })

    if (membership === null) {
      return false
    }

    if (membership.removedAt === null) {
      return true
    }

    if (
      membership.course.archivedAt !== null &&
      membership.removedAt.getTime() >= membership.course.archivedAt.getTime()
    ) {
      return true
    }

    return false
  }

  async courseExists(courseId: string): Promise<boolean> {
    const course = await this.prismaService.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    })

    return course !== null
  }

  async createSession(
    courseId: string,
    studentId: string,
    title: string,
  ): Promise<ChatSessionRecord | null> {
    try {
      return await this.prismaService.chatSession.create({
        data: {
          courseId,
          studentId,
          title,
        },
        select: chatSessionSelect,
      })
    } catch (error) {
      // The composite (course_id, student_id) foreign key onto an active
      // membership can fail with P2003 if the membership was removed between
      // the guard check and the insert. Surface it as "no active membership".
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        return null
      }

      throw error
    }
  }

  listSessions(
    courseId: string,
    studentId: string,
    pagination: SessionListPagination,
  ) {
    return this.prismaService.chatSession.findMany({
      where: {
        courseId,
        studentId,
        deletedAt: null,
      },
      select: chatSessionSelect,
      orderBy: [
        {
          lastMessageAt: {
            sort: 'desc',
            nulls: 'last',
          },
        },
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      take: pagination.limit,
      ...(pagination.cursor != null
        ? { cursor: { id: pagination.cursor }, skip: 1 }
        : {}),
    })
  }

  findOwnedActiveSession(
    courseId: string,
    sessionId: string,
    studentId: string,
  ) {
    return this.prismaService.chatSession.findFirst({
      where: ownedActiveSessionWhere(courseId, sessionId, studentId),
      select: chatSessionSelect,
    })
  }

  findExportableSession(
    courseId: string,
    sessionId: string,
    studentId: string,
  ): Promise<ExportableSessionRecord | null> {
    return this.prismaService.chatSession.findFirst({
      where: {
        id: sessionId,
        courseId,
        studentId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        course: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
      },
    })
  }

  listMessagesForExport(
    sessionId: string,
    cursor?: number,
    limit = 100,
  ): Promise<ExportableMessageRecord[]> {
    return this.prismaService.message.findMany({
      where: {
        sessionId,
        role: { in: [MessageRole.STUDENT, MessageRole.ASSISTANT] },
        status: MessageStatus.COMPLETED,
        ...(cursor !== undefined ? { sequence: { gt: cursor } } : {}),
      },
      orderBy: {
        sequence: 'asc',
      },
      take: limit,
      select: {
        id: true,
        sequence: true,
        role: true,
        content: true,
        guidanceLabel: true,
        createdAt: true,
        completedAt: true,
      },
    })
  }

  async renameSession(
    courseId: string,
    sessionId: string,
    studentId: string,
    title: string,
  ) {
    const result = await this.prismaService.chatSession.updateManyAndReturn({
      where: ownedActiveSessionWhere(courseId, sessionId, studentId),
      data: {
        title,
      },
      select: chatSessionSelect,
      limit: 1,
    })

    return result[0] ?? null
  }

  async softDeleteSession(
    input: SoftDeleteChatSessionInput,
  ): Promise<SoftDeleteSessionOutcome> {
    return this.prismaService.$transaction(async (tx) => {
      const result = await tx.chatSession.updateMany({
        where: ownedActiveSessionWhere(
          input.courseId,
          input.sessionId,
          input.studentId,
        ),
        data: {
          deletedAt: new Date(),
        },
      })

      if (result.count === 0) {
        // Distinguish "already deleted by the owner" (idempotent success) from
        // "not owned / does not exist" (a genuine access denial).
        const existing = await tx.chatSession.findFirst({
          where: {
            id: input.sessionId,
            courseId: input.courseId,
            studentId: input.studentId,
          },
          select: {
            deletedAt: true,
          },
        })

        if (existing !== null && existing.deletedAt !== null) {
          return 'already_deleted'
        }

        return 'not_found'
      }

      await this.conversationAuditService.recordSessionDeleted(
        {
          actorUserId: input.studentId,
          courseId: input.courseId,
          sessionId: input.sessionId,
          requestContext: input.requestContext,
        },
        asDatabaseTransaction(tx),
      )

      return 'deleted'
    })
  }
}
