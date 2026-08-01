import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  type MessageRole,
  Prisma,
  type ReviewOutcome,
  ReviewStatus,
  ReviewTriggerType,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const MAX_CITATIONS = 20
const MAX_SNIPPETS = 20

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
  trigger: { type: ReviewTriggerType; reason: string | null; createdAt: Date }
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
          select: { type: true, reason: true, createdAt: true },
        },
        targetMessage: {
          select: {
            sequence: true,
            role: true,
            content: true,
            createdAt: true,
            responseToMessage: {
              select: {
                sequence: true,
                role: true,
                content: true,
                createdAt: true,
              },
            },
            session: {
              select: {
                id: true,
                student: { select: { id: true, displayName: true } },
              },
            },
            citations: {
              orderBy: { citationOrder: 'asc' },
              take: MAX_CITATIONS,
              select: {
                citationOrder: true,
                material: { select: { id: true, title: true } },
              },
            },
            retrievals: {
              orderBy: { rank: 'asc' },
              take: MAX_SNIPPETS,
              select: {
                chunk: {
                  select: { materialId: true, chunkIndex: true, content: true },
                },
              },
            },
          },
        },
        _count: { select: { notifications: true } },
      },
    })

    const trigger = reviewCase?.triggers[0]
    const flagged = reviewCase?.targetMessage.responseToMessage
    if (
      reviewCase === null ||
      trigger === undefined ||
      flagged === null ||
      flagged === undefined
    ) {
      return null
    }

    const contextSelect = {
      role: true,
      content: true,
      createdAt: true,
    } satisfies Prisma.MessageSelect
    const [previousMessages, followingMessages] =
      await this.prisma.$transaction([
        this.prisma.message.findMany({
          where: {
            sessionId: reviewCase.targetMessage.session.id,
            sequence: { lt: flagged.sequence },
          },
          select: contextSelect,
          orderBy: { sequence: 'desc' },
          take: 2,
        }),
        this.prisma.message.findMany({
          where: {
            sessionId: reviewCase.targetMessage.session.id,
            sequence: { gt: reviewCase.targetMessage.sequence },
          },
          select: contextSelect,
          orderBy: { sequence: 'asc' },
          take: 2,
        }),
      ])

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
      course: reviewCase.course,
      student: reviewCase.targetMessage.session.student,
      flaggedExchange: flagged,
      assistantResponse: {
        role: reviewCase.targetMessage.role,
        content: reviewCase.targetMessage.content,
        createdAt: reviewCase.targetMessage.createdAt,
        citations: reviewCase.targetMessage.citations.map((citation) => ({
          order: citation.citationOrder,
          materialId: citation.material.id,
          materialTitle: citation.material.title,
          snippets: reviewCase.targetMessage.retrievals.flatMap((retrieval) =>
            retrieval.chunk?.materialId === citation.material.id
              ? [
                  {
                    chunkNumber: retrieval.chunk.chunkIndex + 1,
                    content: retrieval.chunk.content,
                  },
                ]
              : [],
          ),
        })),
      },
      previousMessages: previousMessages.reverse(),
      followingMessages,
      notificationCount: reviewCase._count.notifications,
    }
  }
}
