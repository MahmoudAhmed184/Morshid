import { Injectable } from '@nestjs/common'

import type { AuthenticatedUser } from '../identity/identity.types'
import type { AuditRequestContext } from '../audit/audit.public'
import type {
  CreateReviewRequest,
  CreateReviewRequestResponseDto,
} from './review-case.dto'
import {
  idempotencyKeyReusedException,
  reviewNotFoundException,
  reviewQuotaExceededException,
  reviewSnapshotTooLargeException,
  targetNotReviewableException,
} from './review-case.errors'
import {
  ReviewCaseRepository,
  type ReviewCaseCreationOutcome,
  type ReviewCaseCreationRecord,
} from './review-case.repository'

@Injectable()
export class ReviewCaseCreator {
  constructor(private readonly repository: ReviewCaseRepository) {}

  async createManual(
    messageId: string,
    body: CreateReviewRequest,
    idempotencyKey: string,
    user: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<CreateReviewRequestResponseDto> {
    const record = await this.createOrThrow({
      kind: 'manual',
      messageId,
      actorUserId: user.id,
      flagReason: body.flagReason,
      reason: body.note,
      idempotencyKey,
      requestContext,
    })

    return {
      caseId: record.caseId,
      messageId: record.messageId,
      status: record.status,
      trigger: 'STUDENT_REQUEST',
      requestedAt: record.requestedAt.toISOString(),
      replayed: record.replayed,
      reviewSummary: {
        status: record.status,
        outcome: record.outcome,
        resolvedAt: record.resolvedAt?.toISOString() ?? null,
        reviewCaseId: record.caseId,
      },
    }
  }

  private async createOrThrow(
    input: Parameters<ReviewCaseRepository['create']>[0],
  ): Promise<ReviewCaseCreationRecord> {
    return this.recordOrThrow(await this.repository.create(input))
  }

  private recordOrThrow(
    outcome: ReviewCaseCreationOutcome,
  ): ReviewCaseCreationRecord {
    switch (outcome.kind) {
      case 'ok':
        return outcome.record
      case 'not_found':
        throw reviewNotFoundException()
      case 'not_reviewable':
        throw targetNotReviewableException()
      case 'idempotency_conflict':
        throw idempotencyKeyReusedException()
      case 'quota_exceeded':
        throw reviewQuotaExceededException()
      case 'snapshot_too_large':
        throw reviewSnapshotTooLargeException()
    }
  }
}
