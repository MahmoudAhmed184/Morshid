import { Injectable } from '@nestjs/common'

import {
  ReviewInboxItemStatus,
  type ReviewInboxItemType,
  Prisma,
} from '../../../generated/prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

export interface StudentReviewInboxRecord {
  id: string
  reviewCaseId: string
  courseId: string
  sessionId: string
  messageId: string
  type: ReviewInboxItemType
  status: ReviewInboxItemStatus
  createdAt: Date
  readAt: Date | null
}

export interface StudentReviewInboxPage {
  records: StudentReviewInboxRecord[]
  nextCursor: string | null
}

export abstract class StudentReviewInboxRepository {
  abstract list(
    recipientUserId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<StudentReviewInboxPage>

  abstract countUnread(recipientUserId: string): Promise<number>

  abstract markRead(
    recipientUserId: string,
    inboxItemId: string,
  ): Promise<StudentReviewInboxRecord | null>
}

@Injectable()
export class PrismaStudentReviewInboxRepository extends StudentReviewInboxRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async list(
    recipientUserId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<StudentReviewInboxPage> {
    const records = await this.prisma.reviewInboxItem.findMany({
      where: { recipientUserId },
      select: reviewInboxItemSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    })
    const hasNextPage = records.length > limit
    const page = hasNextPage ? records.slice(0, limit) : records
    return {
      records: page.map(mapRecord),
      nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
    }
  }

  countUnread(recipientUserId: string): Promise<number> {
    return this.prisma.reviewInboxItem.count({
      where: { recipientUserId, status: ReviewInboxItemStatus.UNREAD },
    })
  }

  markRead(
    recipientUserId: string,
    inboxItemId: string,
  ): Promise<StudentReviewInboxRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.reviewInboxItem.findFirst({
        where: { id: inboxItemId, recipientUserId },
        select: reviewInboxItemSelect,
      })
      if (item === null) return null
      if (item.status !== ReviewInboxItemStatus.UNREAD) {
        return mapRecord(item)
      }

      await tx.reviewInboxItem.updateMany({
        where: {
          id: inboxItemId,
          recipientUserId,
          status: ReviewInboxItemStatus.UNREAD,
          readAt: null,
        },
        data: { status: ReviewInboxItemStatus.READ, readAt: new Date() },
      })
      const updated = await tx.reviewInboxItem.findFirst({
        where: { id: inboxItemId, recipientUserId },
        select: reviewInboxItemSelect,
      })
      return updated === null ? null : mapRecord(updated)
    })
  }
}

const reviewInboxItemSelect = {
  id: true,
  reviewCaseId: true,
  courseId: true,
  sessionId: true,
  messageId: true,
  type: true,
  status: true,
  createdAt: true,
  readAt: true,
} satisfies Prisma.ReviewInboxItemSelect

function mapRecord(
  record: Prisma.ReviewInboxItemGetPayload<{
    select: typeof reviewInboxItemSelect
  }>,
): StudentReviewInboxRecord {
  return {
    id: record.id,
    reviewCaseId: record.reviewCaseId,
    courseId: record.courseId,
    sessionId: record.sessionId,
    messageId: record.messageId,
    type: record.type,
    status: record.status,
    createdAt: record.createdAt,
    readAt: record.readAt,
  }
}
