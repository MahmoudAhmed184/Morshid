import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  Prisma,
  ReviewStatus,
  ReviewTriggerType,
  type StudentFlagReason,
} from '../../generated/prisma/client'
import { PrismaService } from '../../platform/database/prisma.service'

export interface InstructorReviewQueueRecord {
  id: string
  status: ReviewStatus
  createdAt: Date
  course: { id: string; code: string; title: string }
  student: { id: string; displayName: string }
  trigger: ReviewTriggerType
  triggers: ReviewTriggerType[]
  studentFlagReason: StudentFlagReason | null
  studentNote: string | null
}

export interface InstructorReviewQueuePage {
  records: InstructorReviewQueueRecord[]
  pendingCount: number
}

export interface ListInstructorReviewQueueInput {
  instructorId: string
  courseId?: string
  cursor?: string
  studentFlagReason?: StudentFlagReason
  take: number
}

const queueWhere = (
  input: Pick<
    ListInstructorReviewQueueInput,
    'instructorId' | 'courseId' | 'studentFlagReason'
  >,
): Prisma.ReviewCaseWhereInput => ({
  targetMessage: { session: { deletedAt: null } },
  course: {
    ...(input.courseId === undefined ? {} : { id: input.courseId }),
    memberships: {
      some: {
        userId: input.instructorId,
        role: CourseMembershipRole.INSTRUCTOR,
        removedAt: null,
      },
    },
  },
  ...(input.studentFlagReason === undefined
    ? {}
    : {
        triggers: {
          some: {
            type: ReviewTriggerType.STUDENT_REQUEST,
            studentFlagReason: input.studentFlagReason,
          },
        },
      }),
})

export abstract class InstructorReviewQueueRepository {
  abstract list(
    input: ListInstructorReviewQueueInput,
  ): Promise<InstructorReviewQueuePage>
}

@Injectable()
export class PrismaInstructorReviewQueueRepository extends InstructorReviewQueueRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async list(
    input: ListInstructorReviewQueueInput,
  ): Promise<InstructorReviewQueuePage> {
    const where = queueWhere(input)
    const [cases, pendingCount] = await this.prisma.$transaction([
      this.prisma.reviewCase.findMany({
        where,
        select: {
          id: true,
          status: true,
          createdAt: true,
          course: { select: { id: true, code: true, title: true } },
          targetMessage: {
            select: {
              session: {
                select: {
                  student: { select: { id: true, displayName: true } },
                },
              },
            },
          },
          triggers: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: { type: true, studentFlagReason: true, reason: true },
          },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: input.take,
        ...(input.cursor === undefined
          ? {}
          : { cursor: { id: input.cursor }, skip: 1 }),
      }),
      this.prisma.reviewCase.count({
        where: { ...where, status: ReviewStatus.PENDING },
      }),
    ])

    return {
      records: cases.map((reviewCase) => {
        const trigger = reviewCase.triggers[0]
        const studentRequest = reviewCase.triggers.find(
          ({ type }) => type === ReviewTriggerType.STUDENT_REQUEST,
        )
        return {
          id: reviewCase.id,
          status: reviewCase.status,
          createdAt: reviewCase.createdAt,
          course: reviewCase.course,
          student: reviewCase.targetMessage.session.student,
          trigger: trigger.type,
          triggers: reviewCase.triggers.map(({ type }) => type),
          studentFlagReason: studentRequest?.studentFlagReason ?? null,
          studentNote: studentRequest?.reason ?? null,
        }
      }),
      pendingCount,
    }
  }
}
