import { Injectable } from '@nestjs/common'

import {
  CourseMembershipRole,
  type MessageRole,
  Prisma,
  type ReviewOutcome,
  ReviewStatus,
  ReviewTriggerType,
  type StudentFlagReason,
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
        evidence: { select: { evidence: true } },
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
    const studentRequest = reviewCase?.triggers.find(
      ({ type }) => type === ReviewTriggerType.STUDENT_REQUEST,
    )
    const automaticSnapshot =
      reviewCase?.triggers.some(
        ({ type }) => type !== ReviewTriggerType.STUDENT_REQUEST,
      ) === true
        ? readAutomaticSnapshot(reviewCase.evidence?.evidence)
        : null
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
      automaticSnapshot === null
        ? await this.prisma.$transaction([
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
        : [[], []]

    const immutableFlagged =
      automaticSnapshot?.studentPrompt === null ||
      automaticSnapshot?.studentPrompt === undefined
        ? flagged
        : {
            role: flagged.role,
            content: automaticSnapshot.studentPrompt.content,
            createdAt: automaticSnapshot.studentPrompt.createdAt,
          }
    const immutableAssistant =
      automaticSnapshot === null
        ? null
        : {
            role: reviewCase.targetMessage.role,
            content: automaticSnapshot.targetContent,
            createdAt: reviewCase.targetMessage.createdAt,
            citations: automaticSnapshot.citations,
          }

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
      flaggedExchange: immutableFlagged,
      assistantResponse:
        immutableAssistant ?? liveAssistantResponse(reviewCase.targetMessage),
      previousMessages: previousMessages.reverse(),
      followingMessages,
      notificationCount: reviewCase._count.notifications,
    }
  }
}

interface AutomaticSnapshot {
  targetContent: string
  studentPrompt: { content: string; createdAt: Date } | null
  citations: InstructorReviewDetailRecord['assistantResponse']['citations']
}

function readAutomaticSnapshot(
  value: Prisma.JsonValue | undefined,
): AutomaticSnapshot | null {
  if (!isObject(value)) return null
  const target = value.target
  const automaticEvidence = value.automaticEvidence
  if (!isObject(target) || typeof target.content !== 'string') return null

  const studentPrompt =
    isObject(value.studentPrompt) &&
    typeof value.studentPrompt.content === 'string' &&
    typeof value.studentPrompt.createdAt === 'string'
      ? {
          content: value.studentPrompt.content,
          createdAt: validDate(value.studentPrompt.createdAt),
        }
      : null
  const sources: unknown[] =
    isObject(automaticEvidence) && Array.isArray(automaticEvidence.sources)
      ? automaticEvidence.sources
      : []
  const citationsByMaterial = new Map<
    string,
    InstructorReviewDetailRecord['assistantResponse']['citations'][number]
  >()
  for (const rawSource of sources.slice(0, MAX_SNIPPETS)) {
    if (!isObject(rawSource)) continue
    const source = rawSource
    if (
      typeof source.materialId !== 'string' ||
      typeof source.excerpt !== 'string'
    ) {
      continue
    }
    const existing = citationsByMaterial.get(source.materialId)
    const snippet = {
      chunkNumber:
        typeof source.chunkIndex === 'number' &&
        Number.isSafeInteger(source.chunkIndex) &&
        source.chunkIndex >= 0
          ? source.chunkIndex + 1
          : typeof source.rank === 'number' &&
              Number.isSafeInteger(source.rank) &&
              source.rank > 0
            ? source.rank
            : 1,
      content: source.excerpt,
    }
    if (existing === undefined) {
      citationsByMaterial.set(source.materialId, {
        order: citationsByMaterial.size + 1,
        materialId: source.materialId,
        materialTitle:
          typeof source.materialTitle === 'string'
            ? source.materialTitle
            : 'Course material',
        snippets: [snippet],
      })
    } else {
      existing.snippets.push(snippet)
    }
  }

  return {
    targetContent: target.content,
    studentPrompt,
    citations: [...citationsByMaterial.values()].slice(0, MAX_CITATIONS),
  }
}

function liveAssistantResponse(target: {
  role: MessageRole
  content: string
  createdAt: Date
  citations: {
    citationOrder: number
    material: { id: string; title: string }
  }[]
  retrievals: {
    chunk: { materialId: string; chunkIndex: number; content: string } | null
  }[]
}): InstructorReviewDetailRecord['assistantResponse'] {
  return {
    role: target.role,
    content: target.content,
    createdAt: target.createdAt,
    citations: target.citations.map((citation) => ({
      order: citation.citationOrder,
      materialId: citation.material.id,
      materialTitle: citation.material.title,
      snippets: target.retrievals.flatMap((retrieval) =>
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
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validDate(value: string): Date {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date(0) : date
}
