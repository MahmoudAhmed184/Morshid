import { Injectable } from '@nestjs/common'

import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import type { AuditRequestContext } from '../audit/audit.service'
import type {
  InstructorReviewActionResponseDto,
  RejectReviewRequest,
  ResolveReviewRequest,
} from './instructor-review-action.dto'
import {
  InstructorReviewActionRepository,
  type InstructorReviewActionInput,
} from './instructor-review-action.repository'
import {
  automaticReviewNotRejectableException,
  idempotencyKeyReusedException,
  invalidReviewTransitionException,
  outcomeContentMismatchException,
  reviewNotFoundException,
  staleReviewVersionException,
} from './review-case.errors'

@Injectable()
export class InstructorReviewActionService {
  constructor(private readonly repository: InstructorReviewActionRepository) {}

  resolve(
    reviewCaseId: string,
    request: ResolveReviewRequest,
    idempotencyKey: string,
    user: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<InstructorReviewActionResponseDto> {
    return this.apply({
      kind: 'resolve',
      reviewCaseId,
      instructorId: user.id,
      idempotencyKey,
      request,
      requestContext,
    })
  }

  reject(
    reviewCaseId: string,
    request: RejectReviewRequest,
    idempotencyKey: string,
    user: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<InstructorReviewActionResponseDto> {
    return this.apply({
      kind: 'reject',
      reviewCaseId,
      instructorId: user.id,
      idempotencyKey,
      request,
      requestContext,
    })
  }

  private async apply(
    input: InstructorReviewActionInput,
  ): Promise<InstructorReviewActionResponseDto> {
    const outcome = await this.repository.apply(input)
    switch (outcome.kind) {
      case 'ok':
        return {
          ...outcome.record,
          resolvedAt: outcome.record.resolvedAt.toISOString(),
        }
      case 'not_found':
        throw reviewNotFoundException()
      case 'idempotency_conflict':
        throw idempotencyKeyReusedException()
      case 'stale_version':
        throw staleReviewVersionException()
      case 'invalid_transition':
        throw invalidReviewTransitionException()
      case 'outcome_content_mismatch':
        throw outcomeContentMismatchException()
      case 'automatic_not_rejectable':
        throw automaticReviewNotRejectableException()
    }
  }
}
