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
import { resolvePolicyDayWindow } from '../allowances/interface/allowances-resolver'
import { MAX_CONVERSATION_TURNS } from './interface/conversation-values'
import type {
  ChatSessionRecord,
  ChatSessionSummaryRecord,
  ExportableMessageRecord,
  ExportableSessionRecord,
  SessionListPagination,
  SoftDeleteChatSessionInput,
  SoftDeleteSessionOutcome,
} from './interface/conversation-records'

export const MAX_CONTEXT_WINDOW_TOKENS = 258_000

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

  abstract getSessionSummary(
    courseId: string,
    sessionId: string,
    studentId: string,
  ): Promise<ChatSessionSummaryRecord | null>

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

  async getSessionSummary(
    courseId: string,
    sessionId: string,
    studentId: string,
  ): Promise<ChatSessionSummaryRecord | null> {
    const session = await this.prismaService.chatSession.findFirst({
      where: ownedActiveSessionWhere(courseId, sessionId, studentId),
      select: { id: true },
    })

    if (session === null) {
      return null
    }

    const [turnsUsed, latestAssistant, tokenAggregation] = await Promise.all([
      this.prismaService.message.count({
        where: {
          sessionId,
          role: MessageRole.STUDENT,
        },
      }),
      this.prismaService.message.findFirst({
        where: {
          sessionId,
          role: MessageRole.ASSISTANT,
          status: MessageStatus.COMPLETED,
        },
        orderBy: {
          sequence: 'desc',
        },
        select: {
          inputTokens: true,
        },
      }),
      this.prismaService.message.aggregate({
        where: {
          sessionId,
          status: MessageStatus.COMPLETED,
        },
        _sum: {
          inputTokens: true,
          outputTokens: true,
        },
      }),
    ])

    const turnLimit = MAX_CONVERSATION_TURNS
    const turnsRemaining = Math.max(0, turnLimit - turnsUsed)
    const isTurnLimitExhausted = turnsRemaining === 0
    const contextTokens = latestAssistant?.inputTokens ?? 0
    const maxContextTokens = MAX_CONTEXT_WINDOW_TOKENS
    const contextPercent = Math.min(
      100,
      Math.max(0, Math.round((contextTokens / maxContextTokens) * 100)),
    )
    const totalProcessed =
      (tokenAggregation._sum.inputTokens ?? 0) +
      (tokenAggregation._sum.outputTokens ?? 0)
    const totalProcessedTokens = totalProcessed > 0 ? totalProcessed : 0

    const policyDay = resolvePolicyDayWindow(new Date())

    return {
      turnsUsed,
      turnLimit,
      turnsRemaining,
      isTurnLimitExhausted,
      contextTokens,
      maxContextTokens,
      contextPercent,
      totalProcessedTokens,
      policyDay: policyDay.start.toISOString().slice(0, 10),
      policyTimeZone: policyDay.policyTimeZone,
      resetAt: policyDay.resetAt.toISOString(),
    }
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
