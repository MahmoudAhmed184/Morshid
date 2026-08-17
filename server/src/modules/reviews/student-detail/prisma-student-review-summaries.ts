import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../platform/database/prisma.service'
import {
  StudentReviewSummaries,
  type StudentPublishedGuidance,
  type StudentReviewSummary,
} from '../interface/student-review-summaries'

@Injectable()
export class PrismaStudentReviewSummaries extends StudentReviewSummaries {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  loadForMessages(
    messageIds: readonly string[],
    studentId: string,
  ): Promise<readonly StudentReviewSummary[]> {
    if (messageIds.length === 0) {
      return Promise.resolve([])
    }
    return this.prismaService.reviewCase
      .findMany({
        where: {
          targetMessageId: { in: [...messageIds] },
          triggers: {
            some: {
              OR: [
                { type: { not: 'STUDENT_REQUEST' } },
                { type: 'STUDENT_REQUEST', actorUserId: studentId },
              ],
            },
          },
        },
        select: {
          targetMessageId: true,
          id: true,
          status: true,
          outcome: true,
          resolvedAt: true,
        },
      })
      .then((cases) =>
        cases.map((reviewCase) => ({
          messageId: reviewCase.targetMessageId,
          reviewCaseId: reviewCase.id,
          status: reviewCase.status,
          outcome: reviewCase.outcome,
          resolvedAt: reviewCase.resolvedAt,
        })),
      )
  }

  loadPublishedGuidanceForMessages(
    messageIds: readonly string[],
    studentId: string,
  ): Promise<readonly StudentPublishedGuidance[]> {
    if (messageIds.length === 0) {
      return Promise.resolve([])
    }
    return this.prismaService.reviewCase
      .findMany({
        where: {
          targetMessageId: { in: [...messageIds] },
          status: 'RESOLVED',
          publishedContent: { not: null },
          triggers: {
            some: {
              OR: [
                { type: { not: 'STUDENT_REQUEST' } },
                { type: 'STUDENT_REQUEST', actorUserId: studentId },
              ],
            },
          },
        },
        select: {
          targetMessageId: true,
          id: true,
          outcome: true,
          publishedContent: true,
          resolvedAt: true,
        },
      })
      .then((cases) =>
        cases.map((reviewCase) => ({
          messageId: reviewCase.targetMessageId,
          reviewCaseId: reviewCase.id,
          outcome: reviewCase.outcome,
          publishedContent: reviewCase.publishedContent,
          resolvedAt: reviewCase.resolvedAt,
        })),
      )
  }
}
