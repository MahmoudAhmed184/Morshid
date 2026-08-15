import { Injectable } from '@nestjs/common'

import { Prisma } from '../../../../generated/prisma/client'
import { PrismaService } from '../../../../platform/database/prisma.service'
import {
  SolutionProtectionSource,
  SolutionProtectionStatus,
} from '../../tutoring-values'
import {
  SOLUTION_PROTECTION_POLICY_VERSION,
  type PersistedOutputProtectionDecision,
} from './solution-protection.types'
import type { TopicSolutionProtectionProposal } from './solution-protection.policy'

export interface ResolveOutputProtectionDecisionInput {
  readonly attemptId: string
  readonly topicId: string
  readonly explicitProtectedSolutionSignal: boolean
  readonly proposal: TopicSolutionProtectionProposal
}

export abstract class SolutionProtectionRepository {
  abstract resolveAttemptDecision(
    input: ResolveOutputProtectionDecisionInput,
  ): Promise<PersistedOutputProtectionDecision>
}

@Injectable()
export class PrismaSolutionProtectionRepository extends SolutionProtectionRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  resolveAttemptDecision(
    input: ResolveOutputProtectionDecisionInput,
  ): Promise<PersistedOutputProtectionDecision> {
    return this.prismaService.$transaction(async (tx) => {
      const attempt = await tx.tutoringAttempt.findFirstOrThrow({
        where: { id: input.attemptId, topicId: input.topicId },
        select: {
          explicitProtectedSolutionSignal: true,
          effectiveSolutionProtection: true,
          solutionProtectionSource: true,
          solutionProtectionPolicyVersion: true,
          solutionProtectionResolvedAt: true,
          retryOf: {
            select: {
              explicitProtectedSolutionSignal: true,
              effectiveSolutionProtection: true,
              solutionProtectionSource: true,
              solutionProtectionPolicyVersion: true,
              solutionProtectionResolvedAt: true,
            },
          },
        },
      })
      const existing = decisionFromAttempt(input.topicId, attempt)
      if (existing !== null) {
        return existing
      }

      const retryDecision = decisionFromAttempt(input.topicId, attempt.retryOf)
      if (retryDecision !== null) {
        return persistAttemptDecision(tx, input.attemptId, retryDecision)
      }

      const now = new Date()
      if (input.proposal.status === SolutionProtectionStatus.PROTECTED) {
        await tx.topic.updateMany({
          where: {
            id: input.topicId,
            solutionProtectionStatus: {
              not: SolutionProtectionStatus.PROTECTED,
            },
          },
          data: {
            solutionProtectionStatus: SolutionProtectionStatus.PROTECTED,
            solutionProtectionSource: requireProposalSource(input.proposal),
            solutionProtectionPolicyVersion: SOLUTION_PROTECTION_POLICY_VERSION,
            solutionProtectionEstablishedAt: now,
          },
        })
      } else if (
        input.proposal.status === SolutionProtectionStatus.UNPROTECTED
      ) {
        await tx.topic.updateMany({
          where: {
            id: input.topicId,
            solutionProtectionStatus: SolutionProtectionStatus.UNKNOWN,
          },
          data: {
            solutionProtectionStatus: SolutionProtectionStatus.UNPROTECTED,
            solutionProtectionSource: requireProposalSource(input.proposal),
            solutionProtectionPolicyVersion: SOLUTION_PROTECTION_POLICY_VERSION,
            solutionProtectionEstablishedAt: now,
          },
        })
      }

      const topic = await tx.topic.findUniqueOrThrow({
        where: { id: input.topicId },
        select: {
          solutionProtectionStatus: true,
          solutionProtectionSource: true,
        },
      })
      const decision: PersistedOutputProtectionDecision = {
        protectTargetSolution:
          topic.solutionProtectionStatus !==
          SolutionProtectionStatus.UNPROTECTED,
        topicId: input.topicId,
        source:
          topic.solutionProtectionStatus === SolutionProtectionStatus.UNKNOWN
            ? SolutionProtectionSource.CONSERVATIVE_UNKNOWN
            : requireSource(topic.solutionProtectionSource),
        policyVersion: SOLUTION_PROTECTION_POLICY_VERSION,
        explicitProtectedSolutionSignal: input.explicitProtectedSolutionSignal,
        resolvedAt: now,
      }
      return persistAttemptDecision(tx, input.attemptId, decision)
    })
  }
}

type AttemptDecisionRecord = {
  explicitProtectedSolutionSignal: boolean
  effectiveSolutionProtection: boolean | null
  solutionProtectionSource: SolutionProtectionSource | null
  solutionProtectionPolicyVersion: string | null
  solutionProtectionResolvedAt: Date | null
} | null

function decisionFromAttempt(
  topicId: string,
  attempt: AttemptDecisionRecord,
): PersistedOutputProtectionDecision | null {
  if (
    attempt?.effectiveSolutionProtection === null ||
    attempt?.solutionProtectionSource === null ||
    attempt?.solutionProtectionPolicyVersion !==
      SOLUTION_PROTECTION_POLICY_VERSION ||
    attempt.solutionProtectionResolvedAt === null
  ) {
    return null
  }

  return {
    protectTargetSolution: attempt.effectiveSolutionProtection,
    topicId,
    source: attempt.solutionProtectionSource,
    policyVersion: SOLUTION_PROTECTION_POLICY_VERSION,
    explicitProtectedSolutionSignal: attempt.explicitProtectedSolutionSignal,
    resolvedAt: attempt.solutionProtectionResolvedAt,
  }
}

async function persistAttemptDecision(
  tx: Prisma.TransactionClient,
  attemptId: string,
  decision: PersistedOutputProtectionDecision,
): Promise<PersistedOutputProtectionDecision> {
  const updated = await tx.tutoringAttempt.updateMany({
    where: { id: attemptId, effectiveSolutionProtection: null },
    data: {
      explicitProtectedSolutionSignal: decision.explicitProtectedSolutionSignal,
      effectiveSolutionProtection: decision.protectTargetSolution,
      solutionProtectionSource: decision.source,
      solutionProtectionPolicyVersion: decision.policyVersion,
      solutionProtectionResolvedAt: decision.resolvedAt,
    },
  })
  if (updated.count === 1) {
    return decision
  }

  const persisted = await tx.tutoringAttempt.findUnique({
    where: { id: attemptId },
    select: {
      explicitProtectedSolutionSignal: true,
      effectiveSolutionProtection: true,
      solutionProtectionSource: true,
      solutionProtectionPolicyVersion: true,
      solutionProtectionResolvedAt: true,
    },
  })
  const existing = decisionFromAttempt(decision.topicId, persisted)
  if (existing === null) {
    throw new Error('Output protection decision changed during resolution')
  }
  return existing
}

function requireProposalSource(
  proposal: TopicSolutionProtectionProposal,
): SolutionProtectionSource {
  return requireSource(proposal.source)
}

function requireSource(
  source: SolutionProtectionSource | null,
): SolutionProtectionSource {
  if (source === null) {
    throw new Error('Resolved solution protection requires provenance')
  }
  return source
}
