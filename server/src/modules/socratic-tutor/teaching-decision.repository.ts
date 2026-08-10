import { Injectable } from '@nestjs/common'

import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { EDUCATIONAL_ANALYSIS_SOURCE } from './educational-analysis.types'
import type { TeachingDecisionPolicyDraft } from './teaching-policy.selector'
import type { PreviousTeachingDecisionSnapshot } from './teaching-policy.types'
import { normalizeTeachingGuardPolicy } from './teaching-policy.types'

export type PersistedTeachingDecisionRecord = PreviousTeachingDecisionSnapshot

export type StoreTeachingDecisionResult =
  | {
      readonly kind: 'created'
      readonly decision: PersistedTeachingDecisionRecord
    }
  | {
      readonly kind: 'reused'
      readonly decision: PersistedTeachingDecisionRecord
    }
  | {
      readonly kind: 'analysis_not_found'
    }
  | {
      readonly kind: 'relationship_mismatch'
    }

export abstract class TeachingDecisionRepository {
  abstract findByTurnId(
    turnId: string,
  ): Promise<PersistedTeachingDecisionRecord | null>

  abstract findLatestCompletedForSameTopicBeforeTurn(input: {
    turnId: string
    topicId: string
  }): Promise<PersistedTeachingDecisionRecord | null>

  abstract storeDecision(
    draft: TeachingDecisionPolicyDraft,
  ): Promise<StoreTeachingDecisionResult>
}

const teachingDecisionSelect = {
  id: true,
  turnId: true,
  topicId: true,
  analysisId: true,
  strategy: true,
  primaryTechnique: true,
  supportingTechnique: true,
  guidanceLevel: true,
  revealPolicy: true,
  reflectionMode: true,
  requireStudentAction: true,
  guardPolicy: true,
  decisionReason: true,
  policyVersion: true,
  createdAt: true,
} satisfies Prisma.TeachingDecisionSelect

type TeachingDecisionSelected = Prisma.TeachingDecisionGetPayload<{
  select: typeof teachingDecisionSelect
}>

@Injectable()
export class PrismaTeachingDecisionRepository extends TeachingDecisionRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  findByTurnId(
    turnId: string,
  ): Promise<PersistedTeachingDecisionRecord | null> {
    return this.prismaService.teachingDecision
      .findUnique({
        where: { turnId },
        select: teachingDecisionSelect,
      })
      .then((decision) =>
        decision === null ? null : mapTeachingDecision(decision),
      )
  }

  async findLatestCompletedForSameTopicBeforeTurn(input: {
    turnId: string
    topicId: string
  }): Promise<PersistedTeachingDecisionRecord | null> {
    const currentTurn = await this.prismaService.tutorTurn.findUnique({
      where: { id: input.turnId },
      select: {
        sessionId: true,
        topicId: true,
        studentMessage: { select: { sequence: true } },
      },
    })
    if (
      currentTurn?.topicId !== input.topicId ||
      currentTurn.studentMessage === null
    ) {
      return null
    }

    const decision = await this.prismaService.teachingDecision.findFirst({
      where: {
        topicId: input.topicId,
        analysis: {
          analysisSource: {
            not: EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK,
          },
        },
        turn: {
          sessionId: currentTurn.sessionId,
          status: 'COMPLETED',
          approvedTutorMessageId: { not: null },
          studentMessage: {
            sequence: { lt: currentTurn.studentMessage.sequence },
          },
        },
      },
      orderBy: [
        { turn: { studentMessage: { sequence: 'desc' } } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      select: teachingDecisionSelect,
    })

    return decision === null ? null : mapTeachingDecision(decision)
  }

  async storeDecision(
    draft: TeachingDecisionPolicyDraft,
  ): Promise<StoreTeachingDecisionResult> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const analysis = await tx.educationalAnalysis.findUnique({
          where: { id: draft.analysisId },
          select: {
            id: true,
            turnId: true,
            topicId: true,
            studentMessageId: true,
            turn: {
              select: {
                id: true,
                sessionId: true,
                topicId: true,
                studentMessageId: true,
              },
            },
            topic: {
              select: {
                id: true,
                sessionId: true,
              },
            },
          },
        })

        if (analysis === null) {
          return { kind: 'analysis_not_found' } as const
        }
        if (!analysisMatchesDraft(analysis, draft)) {
          return { kind: 'relationship_mismatch' } as const
        }

        const existing = await tx.teachingDecision.findUnique({
          where: { turnId: draft.turnId },
          select: teachingDecisionSelect,
        })
        if (existing !== null) {
          return {
            kind: 'reused',
            decision: mapTeachingDecision(existing),
          } as const
        }

        const created = await tx.teachingDecision.create({
          data: {
            turnId: draft.turnId,
            topicId: draft.topicId,
            analysisId: draft.analysisId,
            strategy: draft.strategy,
            primaryTechnique: draft.primaryTechnique,
            supportingTechnique: draft.supportingTechnique,
            guidanceLevel: draft.guidanceLevel,
            revealPolicy: draft.revealPolicy,
            reflectionMode: draft.reflectionMode,
            requireStudentAction: draft.requireStudentAction,
            guardPolicy: draft.guardPolicy as unknown as Prisma.InputJsonValue,
            decisionReason: draft.decisionReason,
            policyVersion: draft.policyVersion,
          },
          select: teachingDecisionSelect,
        })

        return {
          kind: 'created',
          decision: mapTeachingDecision(created),
        } as const
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = await this.findByTurnId(draft.turnId)
        if (existing !== null) {
          return { kind: 'reused', decision: existing }
        }
      }

      throw error
    }
  }
}

function analysisMatchesDraft(
  analysis: {
    turnId: string
    topicId: string
    studentMessageId: string
    turn: {
      sessionId: string
      topicId: string | null
      studentMessageId: string | null
    }
    topic: {
      sessionId: string
    }
  },
  draft: TeachingDecisionPolicyDraft,
): boolean {
  return (
    analysis.turnId === draft.turnId &&
    analysis.topicId === draft.topicId &&
    analysis.turn.topicId === draft.topicId &&
    analysis.turn.studentMessageId === analysis.studentMessageId &&
    analysis.turn.sessionId === analysis.topic.sessionId
  )
}

function mapTeachingDecision(
  decision: TeachingDecisionSelected,
): PersistedTeachingDecisionRecord {
  return {
    ...decision,
    guardPolicy: normalizeTeachingGuardPolicy(decision.guardPolicy),
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}
