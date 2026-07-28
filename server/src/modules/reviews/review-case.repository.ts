import { createHash, randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'

import {
  MessageRole,
  MessageStatus,
  Prisma,
  ReviewActionType,
  ReviewOutcome,
  ReviewStatus,
  ReviewTriggerType,
} from '../../generated/prisma/client'
import { AuditService } from '../audit/audit.service'
import type { AuditRequestContext } from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import type { AutomaticReviewEvidenceContribution } from './automatic-review-evidence'

const IDEMPOTENCY_SCOPE = 'review.create.manual'
const MANUAL_REVIEW_DAILY_LIMIT = 3
const SNAPSHOT_LIMIT_BYTES = 128 * 1024
const EXCERPT_CODE_POINTS = 500
const ADJACENT_CONTENT_CODE_POINTS = 2_000
const MAX_SNAPSHOT_CITATIONS = 20
const MAX_SNAPSHOT_RETRIEVALS = 20

export type CreateReviewCaseInput =
  | {
      kind: 'manual'
      messageId: string
      actorUserId: string
      reason: string | null
      idempotencyKey: string
      requestContext?: AuditRequestContext
    }
  | {
      kind: 'automatic'
      messageId: string
      trigger: Exclude<ReviewTriggerType, 'STUDENT_REQUEST'>
      sourceEventKey: string
      evidence: AutomaticReviewEvidenceContribution
      detectorMetadata?: Prisma.InputJsonObject
      requestContext?: AuditRequestContext
    }

export interface ReviewCaseCreationRecord {
  caseId: string
  messageId: string
  status: ReviewStatus
  outcome: ReviewOutcome | null
  resolvedAt: Date | null
  trigger: ReviewTriggerType
  requestedAt: Date
  replayed: boolean
}

export type ReviewCaseCreationOutcome =
  | { kind: 'ok'; record: ReviewCaseCreationRecord }
  | { kind: 'not_found' }
  | { kind: 'not_reviewable' }
  | { kind: 'idempotency_conflict' }
  | { kind: 'quota_exceeded' }
  | { kind: 'snapshot_too_large' }

export abstract class ReviewCaseRepository {
  abstract create(
    input: CreateReviewCaseInput,
  ): Promise<ReviewCaseCreationOutcome>
}

@Injectable()
export class PrismaReviewCaseRepository extends ReviewCaseRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {
    super()
  }

  create(input: CreateReviewCaseInput): Promise<ReviewCaseCreationOutcome> {
    return this.prisma.$transaction(
      async (tx) => {
        const fingerprint = requestFingerprint(input)

        // Serialize delivery identity before the message aggregate. This makes
        // same-key retries deterministic even when two requests arrive before
        // either transaction has inserted its dedupe row.
        const deliveryKey =
          input.kind === 'manual'
            ? `${input.actorUserId}:${IDEMPOTENCY_SCOPE}:${input.idempotencyKey}`
            : `automatic:${input.sourceEventKey}`
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${deliveryKey}, 0)) IS NULL AS locked
        `

        if (input.kind === 'manual') {
          const replay = await tx.idempotencyRecord.findUnique({
            where: {
              actorUserId_operationScope_key: {
                actorUserId: input.actorUserId,
                operationScope: IDEMPOTENCY_SCOPE,
                key: input.idempotencyKey,
              },
            },
          })

          if (replay !== null) {
            if (replay.requestFingerprint !== fingerprint) {
              return { kind: 'idempotency_conflict' }
            }
            const reviewCase = await tx.reviewCase.findUnique({
              where: { id: replay.resourceId },
            })
            if (reviewCase === null) {
              throw new Error(
                'Idempotency record references a missing review case',
              )
            }
            return {
              kind: 'ok',
              record: mapRecord(
                reviewCase,
                ReviewTriggerType.STUDENT_REQUEST,
                true,
              ),
            }
          }
        }

        if (input.kind === 'automatic') {
          const replay = await tx.reviewTrigger.findFirst({
            where: { sourceEventKey: input.sourceEventKey },
            include: { reviewCase: true },
          })
          if (replay !== null) {
            return {
              kind: 'ok',
              record: mapRecord(replay.reviewCase, input.trigger, true),
            }
          }
        }

        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${input.messageId}, 0)) IS NULL AS locked
        `

        const target = await tx.message.findFirst({
          where: {
            id: input.messageId,
            ...(input.kind === 'manual'
              ? { session: { studentId: input.actorUserId } }
              : {}),
          },
          select: targetSelect,
        })

        if (target?.session.deletedAt !== null) {
          return { kind: 'not_found' }
        }
        if (
          target.session.membership.removedAt !== null ||
          target.session.membership.role !== 'STUDENT'
        ) {
          return { kind: 'not_found' }
        }
        if (
          target.role !== MessageRole.ASSISTANT ||
          target.status !== MessageStatus.COMPLETED ||
          target.completedAt === null
        ) {
          return { kind: 'not_reviewable' }
        }

        const existing = await tx.reviewCase.findUnique({
          where: { targetMessageId: target.id },
          include: { triggers: true },
        })
        if (existing !== null) {
          const hasTrigger = existing.triggers.some((trigger) =>
            input.kind === 'manual'
              ? trigger.type === ReviewTriggerType.STUDENT_REQUEST &&
                trigger.actorUserId === input.actorUserId
              : trigger.sourceEventKey === input.sourceEventKey,
          )
          if (!hasTrigger) {
            const version = existing.version + 1
            await tx.reviewCase.update({
              where: { id: existing.id },
              data: {
                version,
                triggers: { create: triggerData(input) },
                actions: {
                  create: actionData(
                    input,
                    ReviewActionType.TRIGGER_ADDED,
                    version,
                    existing.status,
                    existing.status,
                  ),
                },
              },
            })
            await this.recordAudit(
              input,
              tx,
              existing.id,
              target.session.courseId,
              'added',
            )
          }
          if (input.kind === 'manual') {
            await createIdempotencyRecord(
              tx,
              input,
              fingerprint,
              existing.id,
              200,
            )
          }
          return {
            kind: 'ok',
            record: mapRecord(existing, triggerType(input), true),
          }
        }

        if (input.kind === 'manual') {
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${`${input.actorUserId}:manual-review-quota`}, 0)
            ) IS NULL AS locked
          `
          const [usage] = await tx.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*)::bigint AS count
            FROM "review_cases"
            WHERE "requested_by_user_id" = ${input.actorUserId}::uuid
              AND "created_at" >= (
                date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
                AT TIME ZONE 'UTC'
              )
              AND "created_at" < (
                date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
                AT TIME ZONE 'UTC'
              ) + INTERVAL '1 day'
          `
          if (usage.count >= BigInt(MANUAL_REVIEW_DAILY_LIMIT)) {
            return { kind: 'quota_exceeded' }
          }
        }

        const adjacentMessages = await tx.message.findMany({
          where: {
            sessionId: target.session.id,
            sequence: {
              in: [target.sequence - 1, target.sequence + 1].filter(
                (sequence) => sequence > 0,
              ),
            },
          },
          orderBy: { sequence: 'asc' },
          take: 2,
          select: adjacentMessageSelect,
        })
        const snapshot = buildSnapshot(target, adjacentMessages, input)
        const serialized = JSON.stringify(snapshot)
        if (Buffer.byteLength(serialized, 'utf8') > SNAPSHOT_LIMIT_BYTES) {
          return { kind: 'snapshot_too_large' }
        }

        const reviewCase = await tx.reviewCase.create({
          data: {
            targetMessageId: target.id,
            courseId: target.session.courseId,
            requestedByUserId:
              input.kind === 'manual' ? input.actorUserId : null,
            triggers: { create: triggerData(input) },
            evidence: {
              create: {
                schemaVersion: 1,
                evidence: snapshot,
                contentHash: sha256(serialized),
              },
            },
            actions: {
              create: actionData(input, ReviewActionType.CREATED, 1),
            },
          },
        })

        if (input.kind === 'manual') {
          await createIdempotencyRecord(
            tx,
            input,
            fingerprint,
            reviewCase.id,
            201,
          )
        }
        await this.recordAudit(
          input,
          tx,
          reviewCase.id,
          target.session.courseId,
          'created',
        )

        return {
          kind: 'ok',
          record: mapRecord(reviewCase, triggerType(input), false),
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    )
  }

  private async recordAudit(
    input: CreateReviewCaseInput,
    tx: Prisma.TransactionClient,
    caseId: string,
    courseId: string,
    operation: 'created' | 'added',
  ) {
    await this.auditService.recordEvent(
      {
        actorUserId: input.kind === 'manual' ? input.actorUserId : null,
        action:
          operation === 'created'
            ? 'review.case_created'
            : 'review.trigger_added',
        target: { type: 'review_case', id: caseId },
        courseId,
        metadata: { trigger: triggerType(input) },
        requestContext: input.requestContext,
      },
      tx,
    )
  }
}

const targetSelect = {
  id: true,
  sequence: true,
  role: true,
  status: true,
  content: true,
  completedAt: true,
  guidanceLabel: true,
  requestKind: true,
  provider: true,
  model: true,
  promptVersion: true,
  responseToMessage: {
    select: { id: true, role: true, content: true, createdAt: true },
  },
  session: {
    select: {
      id: true,
      courseId: true,
      studentId: true,
      deletedAt: true,
      membership: { select: { role: true, removedAt: true } },
    },
  },
  citations: {
    orderBy: { citationOrder: 'asc' },
    take: MAX_SNAPSHOT_CITATIONS,
    select: {
      citationOrder: true,
      material: { select: { id: true, title: true } },
    },
  },
  retrievals: {
    orderBy: { rank: 'asc' },
    take: MAX_SNAPSHOT_RETRIEVALS,
    select: {
      rank: true,
      similarityScore: true,
      chunk: { select: { id: true, content: true } },
    },
  },
} satisfies Prisma.MessageSelect

type TargetRecord = Prisma.MessageGetPayload<{ select: typeof targetSelect }>

const adjacentMessageSelect = {
  id: true,
  role: true,
  content: true,
  createdAt: true,
  sequence: true,
} satisfies Prisma.MessageSelect

type AdjacentMessageRecord = Prisma.MessageGetPayload<{
  select: typeof adjacentMessageSelect
}>

function buildSnapshot(
  target: TargetRecord,
  adjacentMessages: AdjacentMessageRecord[],
  input: CreateReviewCaseInput,
): Prisma.InputJsonObject {
  const adjacent = (offset: number) => {
    const message = adjacentMessages.find(
      ({ sequence }) => sequence === target.sequence + offset,
    )
    return message === undefined
      ? null
      : {
          id: message.id,
          role: message.role,
          content: truncate(message.content, ADJACENT_CONTENT_CODE_POINTS),
          createdAt: message.createdAt.toISOString(),
        }
  }
  return {
    target: {
      id: target.id,
      content: target.content,
      completedAt: target.completedAt?.toISOString() ?? null,
      guidanceLabel: target.guidanceLabel,
      requestKind: target.requestKind,
      provider: target.provider,
      model: target.model,
      promptVersion: target.promptVersion,
    },
    studentPrompt: target.responseToMessage
      ? {
          id: target.responseToMessage.id,
          content: target.responseToMessage.content,
          createdAt: target.responseToMessage.createdAt.toISOString(),
        }
      : null,
    context: { previous: adjacent(-1), next: adjacent(1) },
    citations: target.citations.map((citation) => ({
      order: citation.citationOrder,
      materialId: citation.material.id,
      title: citation.material.title,
    })),
    retrievals: target.retrievals.map((retrieval) => ({
      rank: retrieval.rank,
      score: retrieval.similarityScore?.toString() ?? null,
      chunkId: retrieval.chunk?.id ?? null,
      excerpt:
        retrieval.chunk === null
          ? null
          : truncate(
              retrieval.chunk.content.replace(/\s+/gu, ' ').trim(),
              EXCERPT_CODE_POINTS,
            ),
    })),
    automaticEvidence:
      input.kind === 'automatic'
        ? automaticEvidenceSnapshot(input.evidence)
        : null,
    integrity: {
      courseId: target.session.courseId,
      studentId: target.session.studentId,
      sessionId: target.session.id,
      trigger: triggerType(input),
    },
  }
}

function automaticEvidenceSnapshot(
  evidence: AutomaticReviewEvidenceContribution,
): Prisma.InputJsonObject {
  return {
    summary: evidence.summary,
    sources: (evidence.sources ?? []).map((source) => ({
      ...(source.materialId === undefined
        ? {}
        : { materialId: source.materialId }),
      ...(source.chunkId === undefined ? {} : { chunkId: source.chunkId }),
      excerpt: source.excerpt,
      ...(source.rank === undefined ? {} : { rank: source.rank }),
      ...(source.score === undefined ? {} : { score: source.score }),
    })),
    facts: (evidence.facts ?? []).map((fact) => ({
      code: fact.code,
      value: fact.value,
    })),
  }
}

function triggerType(input: CreateReviewCaseInput): ReviewTriggerType {
  return input.kind === 'manual'
    ? ReviewTriggerType.STUDENT_REQUEST
    : input.trigger
}

function triggerData(
  input: CreateReviewCaseInput,
): Prisma.ReviewTriggerUncheckedCreateWithoutReviewCaseInput {
  return input.kind === 'manual'
    ? {
        type: ReviewTriggerType.STUDENT_REQUEST,
        actorUserId: input.actorUserId,
        reason: input.reason,
      }
    : {
        type: input.trigger,
        sourceEventKey: input.sourceEventKey,
        detectorMetadata: input.detectorMetadata ?? {},
      }
}

function actionData(
  input: CreateReviewCaseInput,
  actionType: ReviewActionType,
  caseVersion: number,
  fromStatus: ReviewStatus | null = null,
  toStatus: ReviewStatus = ReviewStatus.PENDING,
): Prisma.ReviewActionUncheckedCreateWithoutReviewCaseInput {
  return {
    actorUserId: input.kind === 'manual' ? input.actorUserId : null,
    actionType,
    fromStatus,
    toStatus,
    caseVersion,
    operationId: randomUUID(),
    metadata: { trigger: triggerType(input) },
  }
}

function requestFingerprint(input: CreateReviewCaseInput): string {
  return sha256(
    JSON.stringify(
      input.kind === 'manual'
        ? { messageId: input.messageId, reason: input.reason }
        : { messageId: input.messageId, sourceEventKey: input.sourceEventKey },
    ),
  )
}

async function createIdempotencyRecord(
  tx: Prisma.TransactionClient,
  input: Extract<CreateReviewCaseInput, { kind: 'manual' }>,
  fingerprint: string,
  resourceId: string,
  responseStatus: number,
) {
  await tx.idempotencyRecord.create({
    data: {
      actorUserId: input.actorUserId,
      operationScope: IDEMPOTENCY_SCOPE,
      key: input.idempotencyKey,
      requestFingerprint: fingerprint,
      resourceId,
      responseStatus,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
    },
  })
}

function mapRecord(
  reviewCase: {
    id: string
    targetMessageId: string
    status: ReviewStatus
    outcome: ReviewOutcome | null
    resolvedAt: Date | null
    createdAt: Date
  },
  trigger: ReviewTriggerType,
  replayed: boolean,
): ReviewCaseCreationRecord {
  return {
    caseId: reviewCase.id,
    messageId: reviewCase.targetMessageId,
    status: reviewCase.status,
    outcome: reviewCase.outcome,
    resolvedAt: reviewCase.resolvedAt,
    trigger,
    requestedAt: reviewCase.createdAt,
    replayed,
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function truncate(value: string, limit: number): string {
  return Array.from(value).slice(0, limit).join('')
}
