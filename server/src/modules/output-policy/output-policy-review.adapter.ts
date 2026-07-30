import { createHash } from 'node:crypto'

import { Injectable } from '@nestjs/common'

import type { AuditRequestContext } from '../audit/audit.service'
import {
  ReviewCaseCreator,
  type AutomaticReviewCaseResult,
} from '../reviews/review-case.creator'
import {
  OUTPUT_POLICY_VERSION,
  type OutputPolicyDecision,
} from './output-policy.contract'

export interface CreateOutputPolicyReviewRequest {
  readonly assistantMessageId: string
  readonly decision: OutputPolicyDecision
  readonly requestContext?: AuditRequestContext
}

export interface OutputPolicyReviewResult {
  readonly caseId: string
  readonly messageId: string
  readonly status: AutomaticReviewCaseResult['status']
  readonly replayed: boolean
}

export class OutputPolicyReviewIntegrationError extends Error {
  constructor() {
    super('Automatic output-policy review could not be created')
    this.name = 'OutputPolicyReviewIntegrationError'
  }
}

@Injectable()
export class OutputPolicyReviewAdapter {
  constructor(private readonly reviewCaseCreator: ReviewCaseCreator) {}

  async createRequiredReview(
    request: CreateOutputPolicyReviewRequest,
  ): Promise<OutputPolicyReviewResult | null> {
    if (!request.decision.createReview) {
      return null
    }
    if (
      request.decision.reasons.length === 0 ||
      request.decision.reviewEvidence === null
    ) {
      throw new OutputPolicyReviewIntegrationError()
    }

    let aggregate: AutomaticReviewCaseResult | undefined
    for (const reason of request.decision.reasons) {
      const result = await this.reviewCaseCreator.createAutomatic(
        {
          messageId: request.assistantMessageId,
          trigger: reason,
          sourceEventKey: sourceEventKey(request.assistantMessageId, reason),
          evidence: request.decision.reviewEvidence,
          detectorMetadata: {
            policyVersion: OUTPUT_POLICY_VERSION,
            reasonCount: request.decision.reasons.length,
          },
        },
        request.requestContext,
      )

      if (
        result.messageId !== request.assistantMessageId ||
        (aggregate !== undefined &&
          (aggregate.caseId !== result.caseId ||
            aggregate.messageId !== result.messageId))
      ) {
        throw new OutputPolicyReviewIntegrationError()
      }
      aggregate = result
    }

    if (aggregate === undefined) {
      throw new OutputPolicyReviewIntegrationError()
    }

    return Object.freeze({
      caseId: aggregate.caseId,
      messageId: aggregate.messageId,
      status: aggregate.status,
      replayed: aggregate.replayed,
    })
  }
}

function sourceEventKey(messageId: string, reason: string): string {
  const messageDigest = createHash('sha256')
    .update(messageId, 'utf8')
    .digest('hex')
    .slice(0, 32)
  return `${OUTPUT_POLICY_VERSION}:${messageDigest}:${reason}`
}
