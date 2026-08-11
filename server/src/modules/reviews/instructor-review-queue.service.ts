import { Injectable } from '@nestjs/common'

import { ReviewStatus } from '../../generated/prisma/client'
import type { AuthenticatedUser } from '../identity/identity.types'
import { reviewNotFoundException } from './review-case.errors'
import type {
  InstructorReviewQueueQuery,
  InstructorReviewQueueResponseDto,
} from './instructor-review-queue.dto'
import { InstructorReviewQueueRepository } from './instructor-review-queue.repository'

@Injectable()
export class InstructorReviewQueueService {
  constructor(private readonly repository: InstructorReviewQueueRepository) {}

  async list(
    user: AuthenticatedUser,
    query: InstructorReviewQueueQuery,
    now = new Date(),
  ): Promise<InstructorReviewQueueResponseDto> {
    if (
      query.courseId !== undefined &&
      !(await this.repository.isOwnedCourse(user.id, query.courseId))
    ) {
      throw reviewNotFoundException()
    }

    const page = await this.repository.list({
      instructorId: user.id,
      courseId: query.courseId,
      cursor: query.cursor,
      studentFlagReason: query.studentFlagReason,
      take: query.limit + 1,
    })
    const hasNextPage = page.records.length > query.limit
    const records = hasNextPage
      ? page.records.slice(0, query.limit)
      : page.records

    return {
      items: records.map((record) => ({
        reviewCaseId: record.id,
        status: record.status,
        trigger: record.trigger,
        triggers: record.triggers,
        studentFlagReason: record.studentFlagReason,
        studentNote: record.studentNote,
        createdAt: record.createdAt.toISOString(),
        age: Math.max(
          0,
          Math.floor((now.getTime() - record.createdAt.getTime()) / 1_000),
        ),
        course: record.course,
        student: record.student,
        pending: record.status === ReviewStatus.PENDING,
      })),
      pendingCount: page.pendingCount,
      nextCursor: hasNextPage ? (records.at(-1)?.id ?? null) : null,
    }
  }
}
