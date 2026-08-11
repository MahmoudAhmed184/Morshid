import { Injectable } from '@nestjs/common'

import type {
  Prisma,
  ReviewStatus,
  ReviewTriggerType,
} from '../../generated/prisma/client'
import type { AuthenticatedUser } from '../identity/identity.types'
import type { AuditRequestContext } from '../audit/audit.public'
import {
  buildAutomaticReviewEvidence,
  type AutomaticReviewEvidenceInput,
} from './evidence/automatic-review-evidence'
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
  AutomaticReviewBatchError,
  ReviewCaseRepository,
  type ReviewCaseCreationOutcome,
  type ReviewCaseCreationRecord,
} from './review-case.repository'

export interface AutomaticReviewCaseRequest {
  messageId: string
  triggers: readonly AutomaticReviewTriggerRequest[]
  evidence: AutomaticReviewEvidenceInput
  requestContext?: AuditRequestContext
}

export interface AutomaticReviewTriggerRequest {
  trigger: Exclude<ReviewTriggerType, 'STUDENT_REQUEST'>
  sourceEventKey: string
  detectorMetadata?: Prisma.InputJsonObject
}

export interface AutomaticReviewCaseResult {
  caseId: string
  messageId: string
  status: ReviewStatus
  replayed: boolean
}

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

  async createAutomaticBatch(
    request: AutomaticReviewCaseRequest,
  ): Promise<AutomaticReviewCaseResult> {
    if (request.triggers.length === 0) {
      throw new TypeError('At least one automatic review trigger is required')
    }
    const evidence = buildAutomaticReviewEvidence(request.evidence)
    let records: ReviewCaseCreationOutcome[]
    try {
      records = await this.repository.createAutomaticBatch(
        request.triggers.map((trigger) => ({
          kind: 'automatic' as const,
          messageId: request.messageId,
          ...trigger,
          evidence,
          requestContext: request.requestContext,
        })),
      )
    } catch (error) {
      if (error instanceof AutomaticReviewBatchError) {
        this.recordOrThrow(error.outcome)
      }
      throw error
    }
    const mappedRecords = records.map((outcome) => this.recordOrThrow(outcome))
    const first = mappedRecords[0]
    if (
      mappedRecords.some(
        (record) =>
          record.caseId !== first.caseId ||
          record.messageId !== request.messageId,
      )
    ) {
      throw new Error(
        'Automatic review triggers must resolve to one message-scoped case',
      )
    }
    return {
      caseId: first.caseId,
      messageId: first.messageId,
      status: first.status,
      replayed: mappedRecords.every((record) => record.replayed),
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
