import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  type MessageGuidanceLabel,
  type MessageRequestKind,
  type MessageRole,
  type MessageStatus,
  Prisma,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { AuditRequestContext } from '../audit/audit.service'
import { StudentChatAuditService } from './student-chat.audit.service'

export interface ChatSessionRecord {
  id: string
  courseId: string
  title: string
  lastSequence: number
  lastMessageAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface SoftDeleteChatSessionInput {
  courseId: string
  sessionId: string
  studentId: string
  requestContext?: AuditRequestContext
}

export interface ChatMessageRecord {
  id: string
  sequence: number
  role: MessageRole
  authorUserId: string | null
  responseToMessageId: string | null
  content: string
  status: MessageStatus
  requestKind: MessageRequestKind | null
  guidanceLabel: MessageGuidanceLabel | null
  hintLevel: number | null
  errorCode: string | null
  createdAt: Date
  completedAt: Date | null
}

const chatSessionSelect = {
  id: true,
  courseId: true,
  title: true,
  lastSequence: true,
  lastMessageAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ChatSessionSelect

const chatMessageSelect = {
  id: true,
  sequence: true,
  role: true,
  authorUserId: true,
  responseToMessageId: true,
  content: true,
  status: true,
  requestKind: true,
  guidanceLabel: true,
  hintLevel: true,
  errorCode: true,
  createdAt: true,
  completedAt: true,
} satisfies Prisma.MessageSelect

export abstract class StudentChatRepository {
  abstract hasActiveStudentMembership(
    courseId: string,
    studentId: string,
  ): Promise<boolean>

  abstract createSession(
    courseId: string,
    studentId: string,
    title: string,
  ): Promise<ChatSessionRecord>

  abstract listSessions(
    courseId: string,
    studentId: string,
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
  ): Promise<boolean>

  abstract listMessages(
    courseId: string,
    sessionId: string,
    studentId: string,
  ): Promise<ChatMessageRecord[] | null>
}

@Injectable()
export class PrismaStudentChatRepository extends StudentChatRepository {
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

  createSession(courseId: string, studentId: string, title: string) {
    return this.prismaService.chatSession.create({
      data: {
        courseId,
        studentId,
        title,
        lastSequence: 0,
        lastMessageAt: null,
        deletedAt: null,
      },
      select: chatSessionSelect,
    })
  }

  listSessions(courseId: string, studentId: string) {
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
      ],
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

  async softDeleteSession(input: SoftDeleteChatSessionInput): Promise<boolean> {
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
        return false
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

      return true
    })
  }

  async listMessages(
    courseId: string,
    sessionId: string,
    studentId: string,
  ): Promise<ChatMessageRecord[] | null> {
    const session = await this.prismaService.chatSession.findFirst({
      where: ownedActiveSessionWhere(courseId, sessionId, studentId),
      select: {
        id: true,
        messages: {
          select: chatMessageSelect,
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    })

    return session?.messages ?? null
  }
}

function ownedActiveSessionWhere(
  courseId: string,
  sessionId: string,
  studentId: string,
): Prisma.ChatSessionWhereInput {
  return {
    id: sessionId,
    courseId,
    studentId,
    deletedAt: null,
  }
}
