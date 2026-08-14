import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  MessageRole,
  type ReviewActionType,
  type ReviewOutcome,
  ReviewStatus,
  ReviewTriggerType,
  type StudentFlagReason,
} from '../../../generated/prisma/client'
import { PrismaService } from '../../../platform/database/prisma.service'
import {
  parseReviewEvidence,
  type ReviewEvidenceSnapshot,
} from '../evidence/review-evidence'
import { reviewEvidenceContentHash } from '../evidence/review-evidence-integrity'

const MAX_CITATIONS = 20

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
  triggers: { type: ReviewTriggerType; createdAt: Date }[]
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
  abstract findCourseId(reviewCaseId: string): Promise<string | null>

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

  findCourseId(reviewCaseId: string): Promise<string | null> {
    return this.prisma.reviewCase
      .findUnique({
        where: { id: reviewCaseId },
        select: { courseId: true },
      })
      .then((reviewCase) => reviewCase?.courseId ?? null)
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
      },
    })

    const trigger = reviewCase?.triggers[0]
    const studentRequest = reviewCase?.triggers.find(
      ({ type }) => type === ReviewTriggerType.STUDENT_REQUEST,
    )
    const evidenceRecord = reviewCase?.evidence
    const evidence = parseReviewEvidence(
      evidenceRecord?.schemaVersion === 1 ? evidenceRecord.evidence : undefined,
    )
    const evidenceHashMatches =
      evidence !== null &&
      evidenceRecord?.contentHash !== undefined &&
      reviewEvidenceContentHash(evidenceRecord.evidence) ===
        evidenceRecord.contentHash
    const assistantCreatedAt =
      evidence !== null ? evidence.target.createdAt : null
    const studentPrompt = evidence?.studentPrompt ?? null
    if (
      reviewCase === null ||
      trigger === undefined ||
      evidence === null ||
      !evidenceHashMatches ||
      studentPrompt === null ||
      assistantCreatedAt === null
    ) {
      return null
    }
    const snapshot = evidence
    const automaticCitations = citationsFromAutomaticEvidence(
      snapshot.automaticEvidence,
    )
    const previousMessages = snapshot.context.previousMessages
    const followingMessages = snapshot.context.followingMessages

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
      triggers: reviewCase.triggers.map(({ type, createdAt }) => ({
        type,
        createdAt,
      })),
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
        role: snapshot.target.role,
        content: snapshot.target.content,
        createdAt: parseSnapshotDate(assistantCreatedAt),
        citations:
          automaticCitations.length > 0
            ? automaticCitations
            : snapshot.citations.map((citation) => ({
                order: citation.order,
                materialId: citation.materialId,
                materialTitle: citation.title,
                snippets: snapshot.retrievals.flatMap((retrieval) =>
                  retrieval.materialId === citation.materialId &&
                  retrieval.chunkNumber !== null &&
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

function citationsFromAutomaticEvidence(
  evidence: ReviewEvidenceSnapshot['automaticEvidence'],
): InstructorReviewDetailRecord['assistantResponse']['citations'] {
  const citations = new Map<
    string,
    InstructorReviewDetailRecord['assistantResponse']['citations'][number]
  >()
  for (const source of evidence?.sources ?? []) {
    if (source.materialId === undefined) continue
    const existing = citations.get(source.materialId)
    const snippet = {
      chunkNumber:
        source.chunkIndex === undefined
          ? (source.rank ?? 1)
          : source.chunkIndex + 1,
      content: source.excerpt,
    }
    if (existing === undefined) {
      citations.set(source.materialId, {
        order: citations.size + 1,
        materialId: source.materialId,
        materialTitle: source.materialTitle ?? 'Course material',
        snippets: [snippet],
      })
    } else {
      existing.snippets.push(snippet)
    }
  }
  return [...citations.values()].slice(0, MAX_CITATIONS)
}

function mapEvidenceMessage(
  message: ReviewEvidenceSnapshot['context']['previousMessages'][number],
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
