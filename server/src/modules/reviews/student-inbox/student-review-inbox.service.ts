import { Injectable } from '@nestjs/common'

import { ReviewInboxItemType } from '../../../generated/prisma/client'
import type { AuthenticatedUser } from '../../identity/identity.types'
import type {
  StudentReviewInboxItemDto,
  StudentReviewInboxListQuery,
  StudentReviewInboxListResponseDto,
  StudentReviewInboxUnreadCountDto,
} from './student-review-inbox.dto'
import { reviewInboxItemNotFoundException } from './student-review-inbox.errors'
import {
  StudentReviewInboxRepository,
  type StudentReviewInboxRecord,
} from './student-review-inbox.repository'

@Injectable()
export class StudentReviewInboxService {
  constructor(private readonly repository: StudentReviewInboxRepository) {}

  async list(
    user: AuthenticatedUser,
    query: StudentReviewInboxListQuery,
  ): Promise<StudentReviewInboxListResponseDto> {
    const page = await this.repository.list(user.id, query.cursor, query.limit)
    return {
      items: page.records.map(presentInboxItem),
      nextCursor: page.nextCursor,
    }
  }

  async unreadCount(
    user: AuthenticatedUser,
  ): Promise<StudentReviewInboxUnreadCountDto> {
    return { unreadCount: await this.repository.countUnread(user.id) }
  }

  async markRead(
    user: AuthenticatedUser,
    inboxItemId: string,
  ): Promise<StudentReviewInboxItemDto> {
    const item = await this.repository.markRead(user.id, inboxItemId)
    if (item === null) throw reviewInboxItemNotFoundException()
    return presentInboxItem(item)
  }
}

function presentInboxItem(
  item: StudentReviewInboxRecord,
): StudentReviewInboxItemDto {
  const copy = reviewInboxItemCopy(item.type)
  return {
    id: item.id,
    reviewCaseId: item.reviewCaseId,
    courseId: item.courseId,
    sessionId: item.sessionId,
    messageId: item.messageId,
    type: item.type,
    status: item.status,
    ...copy,
    createdAt: item.createdAt.toISOString(),
    readAt: item.readAt?.toISOString() ?? null,
  }
}

function reviewInboxItemCopy(type: ReviewInboxItemType) {
  switch (type) {
    case ReviewInboxItemType.REVIEW_RESOLVED:
      return {
        title: 'Instructor review completed',
        body: 'Your review request has been resolved.',
      }
    case ReviewInboxItemType.REVIEW_REJECTED:
      return {
        title: 'Review request update',
        body: 'Your review request was rejected.',
      }
  }
}
