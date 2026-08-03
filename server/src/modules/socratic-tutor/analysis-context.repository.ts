import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  MessageRole,
  MessageStatus,
  Prisma,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type {
  AnalysisContextMessage,
  CourseMetadataContext,
} from './analysis-context.types'

export const ANALYSIS_CONTEXT_CANDIDATE_HISTORY_LIMIT = 80

export interface AnalysisContextBaseInput {
  courseId: string
  sessionId: string
  studentId: string
  studentMessageId: string
}

export interface AnalysisHistoryCandidateInput {
  courseId: string
  sessionId: string
  studentId: string
  topicId: string
  beforeSequence: number
}

export interface AnalysisContextBaseRecord {
  courseMetadata: CourseMetadataContext
  studentMessage: AnalysisContextMessage
}

export abstract class AnalysisContextRepository {
  abstract loadBaseContext(
    input: AnalysisContextBaseInput,
  ): Promise<AnalysisContextBaseRecord | null>

  abstract listHistoryCandidates(
    input: AnalysisHistoryCandidateInput,
  ): Promise<AnalysisContextMessage[]>
}

const analysisContextMessageSelect = {
  id: true,
  sequence: true,
  role: true,
  turnId: true,
  topicId: true,
  authorUserId: true,
  responseToMessageId: true,
  content: true,
  status: true,
  requestKind: true,
  guidanceLabel: true,
  hintLevel: true,
  createdAt: true,
  completedAt: true,
} satisfies Prisma.MessageSelect

@Injectable()
export class PrismaAnalysisContextRepository extends AnalysisContextRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async loadBaseContext(
    input: AnalysisContextBaseInput,
  ): Promise<AnalysisContextBaseRecord | null> {
    const session = await this.prismaService.chatSession.findFirst({
      where: {
        id: input.sessionId,
        courseId: input.courseId,
        studentId: input.studentId,
        deletedAt: null,
        membership: {
          role: CourseMembershipRole.STUDENT,
          removedAt: null,
        },
      },
      select: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
        messages: {
          where: {
            id: input.studentMessageId,
            role: MessageRole.STUDENT,
            authorUserId: input.studentId,
            status: MessageStatus.COMPLETED,
          },
          select: analysisContextMessageSelect,
          take: 1,
        },
      },
    })

    const studentMessage = session?.messages[0]
    if (session === null || studentMessage === undefined) {
      return null
    }

    return {
      courseMetadata: session.course,
      studentMessage,
    }
  }

  async listHistoryCandidates(
    input: AnalysisHistoryCandidateInput,
  ): Promise<AnalysisContextMessage[]> {
    const messages = await this.prismaService.message.findMany({
      where: {
        sessionId: input.sessionId,
        session: {
          courseId: input.courseId,
          studentId: input.studentId,
          deletedAt: null,
          membership: {
            role: CourseMembershipRole.STUDENT,
            removedAt: null,
          },
        },
        topicId: input.topicId,
        sequence: { lt: input.beforeSequence },
        status: MessageStatus.COMPLETED,
        role: { in: [MessageRole.STUDENT, MessageRole.ASSISTANT] },
      },
      select: analysisContextMessageSelect,
      orderBy: [{ sequence: 'desc' }, { id: 'desc' }],
      take: ANALYSIS_CONTEXT_CANDIDATE_HISTORY_LIMIT,
    })

    return messages.reverse()
  }
}
