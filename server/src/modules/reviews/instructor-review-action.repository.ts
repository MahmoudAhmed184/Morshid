import { createHash, randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  ReviewInboxItemType,
  Prisma,
  ReviewActionType,
  ReviewOutcome,
  ReviewStatus,
  ReviewTriggerType,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { asDatabaseTransaction } from '../prisma/database-transaction'
import { AuditService } from '../audit/audit.public'
import type { AuditRequestContext } from '../audit/audit.public'
import type {
  RejectReviewRequest,
  ResolveReviewRequest,
} from './instructor-review-action.dto'

const RESOLVE_SCOPE = 'review.resolve'
const REJECT_SCOPE = 'review.reject'
const IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000

export type InstructorReviewActionInput =
  | {
      kind: 'resolve'
      reviewCaseId: string
      instructorId: string
      idempotencyKey: string
      request: ResolveReviewRequest
      requestContext?: AuditRequestContext
    }
  | {
      kind: 'reject'
      reviewCaseId: string
      instructorId: string
      idempotencyKey: string
      request: RejectReviewRequest
      requestContext?: AuditRequestContext
    }

export interface InstructorReviewActionRecord {
  reviewCaseId: string
  status: ReviewStatus
  outcome: ReviewOutcome
  publishedContent: string | null
  resolutionReason: string | null
  version: number
  resolvedAt: Date
  replayed: boolean
}

export type InstructorReviewActionOutcome =
  | { kind: 'ok'; record: InstructorReviewActionRecord }
  | { kind: 'not_found' }
  | { kind: 'idempotency_conflict' }
  | { kind: 'stale_version' }
  | { kind: 'invalid_transition' }
  | { kind: 'outcome_content_mismatch' }
  | { kind: 'automatic_not_rejectable' }

export abstract class InstructorReviewActionRepository {
  abstract findCourseId(reviewCaseId: string): Promise<string | null>

  abstract apply(
    input: InstructorReviewActionInput,
  ): Promise<InstructorReviewActionOutcome>
}

@Injectable()
export class PrismaInstructorReviewActionRepository extends InstructorReviewActionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {
    super()
  }

  findCourseId(reviewCaseId: string): Promise<string | null> {
    return this.prisma.reviewCase
      .findUnique({
        where: { id: reviewCaseId },
        select: { courseId: true },
      })
      .then((reviewCase) => reviewCase?.courseId ?? null)
  }

  apply(
    input: InstructorReviewActionInput,
  ): Promise<InstructorReviewActionOutcome> {
    return this.prisma.$transaction(
      async (tx) => {
        const scope = operationScope(input)
        const fingerprint = requestFingerprint(input)
        const deliveryKey = `${input.instructorId}:${scope}:${input.idempotencyKey}`
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${deliveryKey}, 0)) IS NULL AS locked
        `

        await tx.idempotencyRecord.deleteMany({
          where: {
            actorUserId: input.instructorId,
            operationScope: scope,
            key: input.idempotencyKey,
            expiresAt: { lte: new Date() },
          },
        })

        const replay = await tx.idempotencyRecord.findUnique({
          where: {
            actorUserId_operationScope_key: {
              actorUserId: input.instructorId,
              operationScope: scope,
              key: input.idempotencyKey,
            },
          },
        })
        if (replay !== null) {
          if (
            replay.requestFingerprint !== fingerprint ||
            replay.resourceId !== input.reviewCaseId
          ) {
            return { kind: 'idempotency_conflict' }
          }
          const reviewCase = await tx.reviewCase.findFirst({
            where: authorizedCaseWhere(input),
            select: terminalCaseSelect,
          })
          return reviewCase === null || !isTerminalRecord(reviewCase)
            ? { kind: 'not_found' }
            : { kind: 'ok', record: mapRecord(reviewCase, true) }
        }

        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${input.reviewCaseId}, 0)) IS NULL AS locked
        `
        const reviewCase = await tx.reviewCase.findFirst({
          where: authorizedCaseWhere(input),
          select: {
            ...terminalCaseSelect,
            targetMessage: {
              select: {
                id: true,
                content: true,
                session: { select: { id: true, studentId: true } },
              },
            },
            triggers: { select: { type: true } },
          },
        })
        if (reviewCase === null) return { kind: 'not_found' }
        if (
          reviewCase.status !== ReviewStatus.PENDING &&
          reviewCase.status !== ReviewStatus.IN_REVIEW
        ) {
          return { kind: 'invalid_transition' }
        }
        if (reviewCase.version !== input.request.expectedVersion) {
          return { kind: 'stale_version' }
        }
        if (
          input.kind === 'reject' &&
          (reviewCase.triggers.length === 0 ||
            reviewCase.triggers.some(
              ({ type }) => type !== ReviewTriggerType.STUDENT_REQUEST,
            ))
        ) {
          return { kind: 'automatic_not_rejectable' }
        }

        const publication = publicationFor(
          input,
          reviewCase.targetMessage.content,
        )
        if (publication === null) return { kind: 'outcome_content_mismatch' }

        const resolvedAt = new Date()
        const version = reviewCase.version + 1
        const operationId = randomUUID()
        const update = await tx.reviewCase.updateMany({
          where: {
            id: reviewCase.id,
            version: reviewCase.version,
            status: { in: [ReviewStatus.PENDING, ReviewStatus.IN_REVIEW] },
          },
          data: {
            status: publication.status,
            outcome: publication.outcome,
            publishedContent: publication.publishedContent,
            resolutionReason: publication.resolutionReason,
            resolvedByUserId: input.instructorId,
            resolvedAt,
            version,
          },
        })
        if (update.count !== 1) return { kind: 'stale_version' }

        await tx.reviewAction.create({
          data: {
            reviewCaseId: reviewCase.id,
            actorUserId: input.instructorId,
            actionType: publication.actionType,
            fromStatus: reviewCase.status,
            toStatus: publication.status,
            content:
              input.kind === 'resolve' &&
              input.request.outcome !== ReviewOutcome.APPROVED
                ? publication.publishedContent
                : null,
            reason: publication.resolutionReason,
            caseVersion: version,
            operationId,
          },
        })
        await tx.reviewInboxItem.create({
          data: {
            recipientUserId: reviewCase.targetMessage.session.studentId,
            reviewCaseId: reviewCase.id,
            courseId: reviewCase.courseId,
            sessionId: reviewCase.targetMessage.session.id,
            messageId: reviewCase.targetMessage.id,
            type:
              publication.status === ReviewStatus.REJECTED
                ? ReviewInboxItemType.REVIEW_REJECTED
                : ReviewInboxItemType.REVIEW_RESOLVED,
          },
        })
        await tx.idempotencyRecord.create({
          data: {
            actorUserId: input.instructorId,
            operationScope: scope,
            key: input.idempotencyKey,
            requestFingerprint: fingerprint,
            resourceId: reviewCase.id,
            responseStatus: 200,
            expiresAt: new Date(
              resolvedAt.getTime() + IDEMPOTENCY_RETENTION_MS,
            ),
          },
        })
        await this.auditService.recordEvent(
          {
            actorUserId: input.instructorId,
            action:
              publication.status === ReviewStatus.REJECTED
                ? 'review.case_rejected'
                : 'review.case_resolved',
            target: { type: 'review_case', id: reviewCase.id },
            courseId: reviewCase.courseId,
            metadata: { outcome: publication.outcome },
            requestContext: input.requestContext,
          },
          asDatabaseTransaction(tx),
        )

        return {
          kind: 'ok',
          record: {
            reviewCaseId: reviewCase.id,
            status: publication.status,
            outcome: publication.outcome,
            publishedContent: publication.publishedContent,
            resolutionReason: publication.resolutionReason,
            version,
            resolvedAt,
            replayed: false,
          },
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    )
  }
}

const terminalCaseSelect = {
  id: true,
  courseId: true,
  status: true,
  outcome: true,
  publishedContent: true,
  resolutionReason: true,
  version: true,
  resolvedAt: true,
} satisfies Prisma.ReviewCaseSelect

function authorizedCaseWhere(
  input: InstructorReviewActionInput,
): Prisma.ReviewCaseWhereInput {
  return {
    id: input.reviewCaseId,
    targetMessage: { session: { deletedAt: null } },
    course: {
      memberships: {
        some: {
          userId: input.instructorId,
          role: CourseMembershipRole.INSTRUCTOR,
          removedAt: null,
        },
      },
    },
  }
}

function operationScope(input: InstructorReviewActionInput) {
  return input.kind === 'resolve' ? RESOLVE_SCOPE : REJECT_SCOPE
}

function requestFingerprint(input: InstructorReviewActionInput) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        kind: input.kind,
        reviewCaseId: input.reviewCaseId,
        request: input.request,
      }),
    )
    .digest('hex')
}

function publicationFor(
  input: InstructorReviewActionInput,
  originalContent: string,
) {
  if (input.kind === 'reject') {
    return {
      status: ReviewStatus.REJECTED,
      outcome: ReviewOutcome.REQUEST_REJECTED,
      publishedContent: null,
      resolutionReason: input.request.reason,
      actionType: ReviewActionType.REJECTED,
    }
  }
  if (input.request.outcome === ReviewOutcome.APPROVED) {
    if (input.request.content !== null) return null
    return {
      status: ReviewStatus.RESOLVED,
      outcome: ReviewOutcome.APPROVED,
      publishedContent: originalContent,
      resolutionReason: input.request.reason,
      actionType: ReviewActionType.APPROVED,
    }
  }
  if (input.request.content === null) return null
  return {
    status: ReviewStatus.RESOLVED,
    outcome: input.request.outcome,
    publishedContent: input.request.content,
    resolutionReason: input.request.reason,
    actionType:
      input.request.outcome === ReviewOutcome.EDITED
        ? ReviewActionType.EDITED
        : ReviewActionType.REPLACED,
  }
}

function isTerminalRecord(record: {
  outcome: ReviewOutcome | null
  resolvedAt: Date | null
}): record is typeof record & { outcome: ReviewOutcome; resolvedAt: Date } {
  return record.outcome !== null && record.resolvedAt !== null
}

function mapRecord(
  record: {
    id: string
    status: ReviewStatus
    outcome: ReviewOutcome
    publishedContent: string | null
    resolutionReason: string | null
    version: number
    resolvedAt: Date
  },
  replayed: boolean,
): InstructorReviewActionRecord {
  return {
    reviewCaseId: record.id,
    status: record.status,
    outcome: record.outcome,
    publishedContent: record.publishedContent,
    resolutionReason: record.resolutionReason,
    version: record.version,
    resolvedAt: record.resolvedAt,
    replayed,
  }
}
