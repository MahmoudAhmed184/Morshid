import { Injectable } from '@nestjs/common'
import { z } from 'zod'

import {
  CourseMembershipRole,
  MessageRole,
  type ReviewActionType,
  type ReviewOutcome,
  ReviewStatus,
  ReviewTriggerType,
  type StudentFlagReason,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { reviewEvidenceContentHash } from './review-evidence-integrity'

const MAX_CITATIONS = 20
const MAX_SNIPPETS = 20

const evidenceMessageSchema = z.object({
  id: z.string(),
  role: z.enum(MessageRole),
  content: z.string(),
  createdAt: z.string(),
})

const reviewEvidenceSchema = z.object({
  target: z.object({
    id: z.string(),
    role: z.enum(MessageRole).optional(),
    content: z.string(),
    createdAt: z.string().optional(),
    completedAt: z.string().nullable(),
  }),
  studentPrompt: z
    .object({
      id: z.string(),
      content: z.string(),
      createdAt: z.string(),
    })
    .nullable(),
  context: z.object({
    previousMessages: z.array(evidenceMessageSchema).optional(),
    followingMessages: z.array(evidenceMessageSchema).optional(),
    previous: evidenceMessageSchema.nullable().optional(),
    next: evidenceMessageSchema.nullable().optional(),
  }),
  citations: z
    .array(
      z.object({
        order: z.number().int().positive(),
        materialId: z.string(),
        title: z.string(),
      }),
    )
    .max(MAX_CITATIONS),
  retrievals: z
    .array(
      z.object({
        rank: z.number().int().positive(),
        materialId: z.string().nullable().optional(),
        chunkNumber: z.number().int().positive().nullable().optional(),
        excerpt: z.string().nullable(),
      }),
    )
    .max(MAX_SNIPPETS),
})

export interface ReviewDetailMessageRecord {
  role: MessageRole
  content: string
  createdAt: Date
}

export interface InstructorReviewDetailRecord {
  id: string
  status: ReviewStatus
  version: number
  canReject: boolean
  outcome: ReviewOutcome | null
  resolvedAt: Date | null
  createdAt: Date
  trigger: { type: ReviewTriggerType; createdAt: Date }
  studentFlagReason: StudentFlagReason | null
  studentNote: string | null
  course: { id: string; code: string; title: string }
  student: { id: string; displayName: string }
  flaggedExchange: ReviewDetailMessageRecord
  assistantResponse: ReviewDetailMessageRecord & {
    citations: {
      order: number
      materialId: string
      materialTitle: string
      snippets: { chunkNumber: number; content: string }[]
    }[]
  }
  previousMessages: ReviewDetailMessageRecord[]
  followingMessages: ReviewDetailMessageRecord[]
  notificationCount: number
  actions: {
    type: ReviewActionType
    actorDisplayName: string | null
    content: string | null
    reason: string | null
    version: number
    createdAt: Date
  }[]
}

export abstract class InstructorReviewDetailRepository {
  abstract findAuthorized(
    instructorId: string,
    reviewCaseId: string,
  ): Promise<InstructorReviewDetailRecord | null>
}

@Injectable()
export class PrismaInstructorReviewDetailRepository extends InstructorReviewDetailRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async findAuthorized(
    instructorId: string,
    reviewCaseId: string,
  ): Promise<InstructorReviewDetailRecord | null> {
    const reviewCase = await this.prisma.reviewCase.findFirst({
      where: {
        id: reviewCaseId,
        course: {
          memberships: {
            some: {
              userId: instructorId,
              role: CourseMembershipRole.INSTRUCTOR,
              removedAt: null,
            },
          },
        },
        targetMessage: { session: { deletedAt: null } },
      },
      select: {
        id: true,
        status: true,
        version: true,
        outcome: true,
        resolvedAt: true,
        createdAt: true,
        course: { select: { id: true, code: true, title: true } },
        triggers: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            type: true,
            studentFlagReason: true,
            reason: true,
            createdAt: true,
          },
        },
        targetMessage: {
          select: {
            session: {
              select: {
                student: { select: { id: true, displayName: true } },
              },
            },
          },
        },
        evidence: {
          select: { schemaVersion: true, evidence: true, contentHash: true },
        },
        actions: {
          orderBy: [{ caseVersion: 'asc' }, { createdAt: 'asc' }],
          select: {
            actionType: true,
            content: true,
            reason: true,
            caseVersion: true,
            createdAt: true,
            actor: { select: { displayName: true } },
          },
        },
        _count: { select: { notifications: true } },
      },
    })

    const trigger = reviewCase?.triggers[0]
    const studentRequest = reviewCase?.triggers.find(
      ({ type }) => type === ReviewTriggerType.STUDENT_REQUEST,
    )
    const evidenceRecord = reviewCase?.evidence
    const evidence = reviewEvidenceSchema.safeParse(
      evidenceRecord?.schemaVersion === 1 ? evidenceRecord.evidence : undefined,
    )
    const evidenceHashMatches =
      evidence.success &&
      evidenceRecord?.contentHash !== undefined &&
      reviewEvidenceContentHash(evidenceRecord.evidence) ===
        evidenceRecord.contentHash
    const assistantCreatedAt = evidence.success
      ? (evidence.data.target.createdAt ?? evidence.data.target.completedAt)
      : null
    const studentPrompt = evidence.success ? evidence.data.studentPrompt : null
    if (
      reviewCase === null ||
      trigger === undefined ||
      !evidence.success ||
      !evidenceHashMatches ||
      studentPrompt === null ||
      assistantCreatedAt === null
    ) {
      return null
    }
    const snapshot = evidence.data
    const previousMessages = snapshot.context.previousMessages ?? []
    const followingMessages =
      snapshot.context.followingMessages ??
      (snapshot.context.next === null || snapshot.context.next === undefined
        ? []
        : [snapshot.context.next])

    return {
      id: reviewCase.id,
      status: reviewCase.status,
      version: reviewCase.version,
      canReject:
        (reviewCase.status === ReviewStatus.PENDING ||
          reviewCase.status === ReviewStatus.IN_REVIEW) &&
        reviewCase.triggers.length > 0 &&
        reviewCase.triggers.every(
          ({ type }) => type === ReviewTriggerType.STUDENT_REQUEST,
        ),
      outcome: reviewCase.outcome,
      resolvedAt: reviewCase.resolvedAt,
      createdAt: reviewCase.createdAt,
      trigger,
      studentFlagReason: studentRequest?.studentFlagReason ?? null,
      studentNote: studentRequest?.reason ?? null,
      course: reviewCase.course,
      student: reviewCase.targetMessage.session.student,
      flaggedExchange: {
        role: MessageRole.STUDENT,
        content: studentPrompt.content,
        createdAt: parseSnapshotDate(studentPrompt.createdAt),
      },
      assistantResponse: {
        role: snapshot.target.role ?? MessageRole.ASSISTANT,
        content: snapshot.target.content,
        createdAt: parseSnapshotDate(assistantCreatedAt),
        citations: snapshot.citations.map((citation) => ({
          order: citation.order,
          materialId: citation.materialId,
          materialTitle: citation.title,
          snippets: snapshot.retrievals.flatMap((retrieval) =>
            retrieval.materialId === citation.materialId &&
            retrieval.chunkNumber !== null &&
            retrieval.chunkNumber !== undefined &&
            retrieval.excerpt !== null
              ? [
                  {
                    chunkNumber: retrieval.chunkNumber,
                    content: retrieval.excerpt,
                  },
                ]
              : [],
          ),
        })),
      },
      previousMessages: previousMessages.map(mapEvidenceMessage),
      followingMessages: followingMessages.map(mapEvidenceMessage),
      notificationCount: reviewCase._count.notifications,
      actions: reviewCase.actions.map((action) => ({
        type: action.actionType,
        actorDisplayName: action.actor?.displayName ?? null,
        content: action.content,
        reason: action.reason,
        version: action.caseVersion,
        createdAt: action.createdAt,
      })),
    }
  }
}

function mapEvidenceMessage(
  message: z.infer<typeof evidenceMessageSchema>,
): ReviewDetailMessageRecord {
  return {
    role: message.role,
    content: message.content,
    createdAt: parseSnapshotDate(message.createdAt),
  }
}

function parseSnapshotDate(value: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Review evidence contains an invalid timestamp')
  }
  return date
}
