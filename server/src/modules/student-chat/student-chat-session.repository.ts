import { Injectable } from '@nestjs/common'

import { CourseMembershipRole, Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { StudentChatAuditService } from './student-chat.audit.service'
import {
  chatSessionSelect,
  ownedActiveSessionWhere,
} from './student-chat.repository.support'
import type {
  ChatSessionRecord,
  SessionListPagination,
  SoftDeleteChatSessionInput,
  SoftDeleteSessionOutcome,
} from './student-chat.repository.types'

export abstract class StudentChatSessionRepository {
  abstract hasActiveStudentMembership(
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
export class PrismaStudentChatSessionRepository extends StudentChatSessionRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly studentChatAuditService: StudentChatAuditService,
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

      await this.studentChatAuditService.recordSessionDeleted(
        {
          actorUserId: input.studentId,
          courseId: input.courseId,
          sessionId: input.sessionId,
          requestContext: input.requestContext,
        },
        tx,
      )

      return 'deleted'
    })
  }
}
