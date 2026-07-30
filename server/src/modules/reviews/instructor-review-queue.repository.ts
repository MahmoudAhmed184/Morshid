import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  Prisma,
  ReviewStatus,
  type ReviewTriggerType,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export interface InstructorReviewQueueRecord {
  id: string
  status: ReviewStatus
  createdAt: Date
  course: { id: string; code: string; title: string }
  student: { id: string; displayName: string }
  trigger: ReviewTriggerType
}

export interface InstructorReviewQueuePage {
  records: InstructorReviewQueueRecord[]
  pendingCount: number
}

export interface ListInstructorReviewQueueInput {
  instructorId: string
  courseId?: string
  cursor?: string
  take: number
}

const queueWhere = (
  input: Pick<ListInstructorReviewQueueInput, 'instructorId' | 'courseId'>,
): Prisma.ReviewCaseWhereInput => ({
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
})

export abstract class InstructorReviewQueueRepository {
  abstract isOwnedCourse(
    instructorId: string,
    courseId: string,
  ): Promise<boolean>

  abstract list(
    input: ListInstructorReviewQueueInput,
  ): Promise<InstructorReviewQueuePage>
}

@Injectable()
export class PrismaInstructorReviewQueueRepository extends InstructorReviewQueueRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async isOwnedCourse(
    instructorId: string,
    courseId: string,
  ): Promise<boolean> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        memberships: {
          some: {
            userId: instructorId,
            role: CourseMembershipRole.INSTRUCTOR,
            removedAt: null,
          },
        },
      },
      select: { id: true },
    })
    return course !== null
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
            take: 1,
            select: { type: true },
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
        return {
          id: reviewCase.id,
          status: reviewCase.status,
          createdAt: reviewCase.createdAt,
          course: reviewCase.course,
          student: reviewCase.targetMessage.session.student,
          trigger: trigger.type,
        }
      }),
      pendingCount,
    }
  }
}
