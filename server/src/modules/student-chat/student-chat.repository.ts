import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  Prisma,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export interface ChatSessionRecord {
  id: string
  courseId: string
  title: string
  lastSequence: number
  lastMessageAt: Date | null
  createdAt: Date
  updatedAt: Date
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
}

@Injectable()
export class PrismaStudentChatRepository extends StudentChatRepository {
  constructor(private readonly prismaService: PrismaService) {
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
}
