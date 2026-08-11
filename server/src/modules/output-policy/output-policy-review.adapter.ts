import { createHash } from 'node:crypto'

import { Injectable } from '@nestjs/common'

import type { AuditRequestContext } from '../audit/audit.public'
import {
  ReviewCaseCreator,
  type AutomaticReviewCaseResult,
} from '../reviews/reviews.public'
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

    const result: AutomaticReviewCaseResult =
      await this.reviewCaseCreator.createAutomaticBatch({
        messageId: request.assistantMessageId,
        triggers: request.decision.reasons.map((reason) => ({
          trigger: reason,
          sourceEventKey: sourceEventKey(request.assistantMessageId, reason),
          detectorMetadata: {
            policyVersion: OUTPUT_POLICY_VERSION,
            reasonCount: request.decision.reasons.length,
            ...metadataFrom(request.decision),
          },
        })),
        evidence: request.decision.reviewEvidence,
        requestContext: request.requestContext,
      })

    return Object.freeze({
      caseId: result.caseId,
      messageId: result.messageId,
      status: result.status,
      replayed: result.replayed,
    })
  }
}

function metadataFrom(
  decision: OutputPolicyDecision,
): Record<string, string | number | boolean> {
  const metadata: Record<string, string | number | boolean> = {}
  for (const fact of decision.reviewEvidence?.facts ?? []) {
    switch (fact.code) {
      case 'detector_version':
        metadata.detectorVersion = fact.value
        break
      case 'embedding_model':
        metadata.embeddingModel = fact.value
        break
    }
  }
  return metadata
}

function sourceEventKey(messageId: string, reason: string): string {
  const messageDigest = createHash('sha256')
    .update(messageId, 'utf8')
    .digest('hex')
    .slice(0, 32)
  return `${OUTPUT_POLICY_VERSION}:${messageDigest}:${reason}`
}
