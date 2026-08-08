import { Injectable } from '@nestjs/common'

import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import { reviewNotFoundException } from './review-case.errors'
import type { StudentReviewDetailDto } from './student-review-detail.dto'
import { StudentReviewDetailRepository } from './student-review-detail.repository'

@Injectable()
export class StudentReviewDetailService {
  constructor(private readonly repository: StudentReviewDetailRepository) {}

  async get(
    user: AuthenticatedRequestUser,
    reviewCaseId: string,
  ): Promise<StudentReviewDetailDto> {
    const record = await this.repository.findOwned(user.id, reviewCaseId)
    const requestTrigger = record?.triggers[0]
    if (record === null || requestTrigger === undefined) {
      throw reviewNotFoundException()
    }

    return {
      reviewCaseId: record.id,
      status: record.status,
      outcome: record.outcome,
      publishedContent: record.publishedContent,
      rejectionReason:
        record.status === 'REJECTED' ? record.resolutionReason : null,
      requestedAt: requestTrigger.createdAt.toISOString(),
      resolvedAt: record.resolvedAt?.toISOString() ?? null,
      messageId: record.targetMessage.id,
      sessionId: record.targetMessage.session.id,
    }
  }
}
