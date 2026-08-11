import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  type ReviewOutcome,
  type ReviewStatus,
  ReviewTriggerType,
} from '../../generated/prisma/client'
import { PrismaService } from '../../platform/database/prisma.service'

export interface StudentReviewDetailRecord {
  id: string
  status: ReviewStatus
  outcome: ReviewOutcome | null
  publishedContent: string | null
  resolutionReason: string | null
  resolvedAt: Date | null
  targetMessage: { id: string; session: { id: string } }
  triggers: { createdAt: Date }[]
}

export abstract class StudentReviewDetailRepository {
  abstract findOwned(
    studentId: string,
    reviewCaseId: string,
  ): Promise<StudentReviewDetailRecord | null>
}

@Injectable()
export class PrismaStudentReviewDetailRepository extends StudentReviewDetailRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  findOwned(
    studentId: string,
    reviewCaseId: string,
  ): Promise<StudentReviewDetailRecord | null> {
    return this.prisma.reviewCase.findFirst({
      where: {
        id: reviewCaseId,
        triggers: {
          some: {
            OR: [
              { type: { not: ReviewTriggerType.STUDENT_REQUEST } },
              {
                type: ReviewTriggerType.STUDENT_REQUEST,
                actorUserId: studentId,
              },
            ],
          },
        },
        course: {
          memberships: {
            some: {
              userId: studentId,
              role: CourseMembershipRole.STUDENT,
              removedAt: null,
            },
          },
        },
        targetMessage: {
          session: { studentId, deletedAt: null },
        },
      },
      select: {
        id: true,
        status: true,
        outcome: true,
        publishedContent: true,
        resolutionReason: true,
        resolvedAt: true,
        targetMessage: {
          select: { id: true, session: { select: { id: true } } },
        },
        triggers: {
          where: {
            OR: [
              { type: { not: ReviewTriggerType.STUDENT_REQUEST } },
              {
                type: ReviewTriggerType.STUDENT_REQUEST,
                actorUserId: studentId,
              },
            ],
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 1,
          select: { createdAt: true },
        },
      },
    })
  }
}
