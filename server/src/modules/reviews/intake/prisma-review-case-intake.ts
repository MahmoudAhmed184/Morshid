import { Injectable } from '@nestjs/common'
import type { DatabaseTransaction } from '../../../platform/database/database-transaction'

import { buildAutomaticReviewEvidence } from '../evidence/automatic-review-evidence'
import {
  ReviewCaseRepository,
  type ReviewCaseCreationOutcome,
} from './review-case.repository'
import {
  idempotencyKeyReusedException,
  reviewNotFoundException,
  reviewQuotaExceededException,
  reviewSnapshotTooLargeException,
  targetNotReviewableException,
} from '../review-case.errors'
import {
  ReviewCaseIntake,
  type AutomaticReviewIntakeInput,
  type AutomaticReviewIntakeResult,
} from '../interface/review-case-intake'

@Injectable()
export class PrismaReviewCaseIntake extends ReviewCaseIntake {
  constructor(private readonly repository: ReviewCaseRepository) {
    super()
  }

  async openAutomatic(
    input: AutomaticReviewIntakeInput,
    transaction: DatabaseTransaction,
  ): Promise<AutomaticReviewIntakeResult> {
    if (input.triggers.length === 0) {
      throw new TypeError('At least one automatic review trigger is required')
    }

    const evidence = buildAutomaticReviewEvidence(input.evidence)
    const outcomes = await this.repository.createAutomaticInTransaction(
      input.triggers.map((trigger) => ({
        kind: 'automatic' as const,
        messageId: input.messageId,
        ...trigger,
        evidence,
        requestContext: input.requestContext,
      })),
      transaction,
    )
    const records = outcomes.map((outcome) => this.recordOrThrow(outcome))
    const first = records[0]
    if (
      records.some(
        (record) =>
          record.caseId !== first.caseId ||
          record.messageId !== input.messageId,
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
      replayed: records.every((record) => record.replayed),
    }
  }

  private recordOrThrow(outcome: ReviewCaseCreationOutcome) {
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
