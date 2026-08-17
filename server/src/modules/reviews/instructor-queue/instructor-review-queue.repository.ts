import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  Prisma,
  ReviewStatus,
  ReviewTriggerType,
  StudentFlagReason,
} from '../../../generated/prisma/client'
import { PrismaService } from '../../../platform/database/prisma.service'

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

export interface InstructorWorkloadSummaryRecord {
  pendingCount: number
  inReviewCount: number
  claimedByMeCount: number
  totalActiveCount: number
  oldestPendingCreatedAt: Date | null
  byStudentFlagReason: { reason: StudentFlagReason; count: number }[]
  byTriggerType: { trigger: ReviewTriggerType; count: number }[]
}

export interface GetInstructorWorkloadSummaryInput {
  instructorId: string
  courseId?: string
}

export abstract class InstructorReviewQueueRepository {
  abstract list(
    input: ListInstructorReviewQueueInput,
  ): Promise<InstructorReviewQueuePage>

  abstract getWorkloadSummary(
    input: GetInstructorWorkloadSummaryInput,
  ): Promise<InstructorWorkloadSummaryRecord>
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

  async getWorkloadSummary(
    input: GetInstructorWorkloadSummaryInput,
  ): Promise<InstructorWorkloadSummaryRecord> {
    const where = queueWhere({
      instructorId: input.instructorId,
      courseId: input.courseId,
    })

    const [
      pendingCount,
      inReviewCount,
      claimedByMeCount,
      oldestPendingCase,
      activeCases,
    ] = await this.prisma.$transaction([
      this.prisma.reviewCase.count({
        where: { ...where, status: ReviewStatus.PENDING },
      }),
      this.prisma.reviewCase.count({
        where: { ...where, status: ReviewStatus.IN_REVIEW },
      }),
      this.prisma.reviewCase.count({
        where: {
          ...where,
          assignedInstructorId: input.instructorId,
          status: { in: [ReviewStatus.PENDING, ReviewStatus.IN_REVIEW] },
        },
      }),
      this.prisma.reviewCase.findFirst({
        where: { ...where, status: ReviewStatus.PENDING },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { createdAt: true },
      }),
      this.prisma.reviewCase.findMany({
        where: {
          ...where,
          status: { in: [ReviewStatus.PENDING, ReviewStatus.IN_REVIEW] },
        },
        select: {
          id: true,
          triggers: {
            select: {
              type: true,
              studentFlagReason: true,
            },
          },
        },
      }),
    ])

    const flagReasonMap = new Map<StudentFlagReason, number>()
    for (const reason of Object.values(StudentFlagReason)) {
      flagReasonMap.set(reason, 0)
    }

    const triggerTypeMap = new Map<ReviewTriggerType, number>()
    for (const triggerType of Object.values(ReviewTriggerType)) {
      triggerTypeMap.set(triggerType, 0)
    }

    for (const reviewCase of activeCases) {
      const seenReasonsInCase = new Set<StudentFlagReason>()
      const seenTriggersInCase = new Set<ReviewTriggerType>()

      for (const trigger of reviewCase.triggers) {
        seenTriggersInCase.add(trigger.type)
        if (
          trigger.type === ReviewTriggerType.STUDENT_REQUEST &&
          trigger.studentFlagReason
        ) {
          seenReasonsInCase.add(trigger.studentFlagReason)
        }
      }

      for (const reason of seenReasonsInCase) {
        flagReasonMap.set(reason, (flagReasonMap.get(reason) ?? 0) + 1)
      }
      for (const triggerType of seenTriggersInCase) {
        triggerTypeMap.set(
          triggerType,
          (triggerTypeMap.get(triggerType) ?? 0) + 1,
        )
      }
    }

    return {
      pendingCount,
      inReviewCount,
      claimedByMeCount,
      totalActiveCount: pendingCount + inReviewCount,
      oldestPendingCreatedAt: oldestPendingCase?.createdAt ?? null,
      byStudentFlagReason: Array.from(flagReasonMap.entries()).map(
        ([reason, count]) => ({ reason, count }),
      ),
      byTriggerType: Array.from(triggerTypeMap.entries()).map(
        ([trigger, count]) => ({ trigger, count }),
      ),
    }
  }
}
