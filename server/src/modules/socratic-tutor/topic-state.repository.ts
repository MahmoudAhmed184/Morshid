import { Injectable } from '@nestjs/common'

import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type {
  TopicStatePatch,
  TopicStateSnapshot,
} from './topic-state.types'

export abstract class TopicStateRepository {
  abstract topicExists(topicId: string): Promise<boolean>

  abstract findByTopicId(
    topicId: string,
  ): Promise<TopicStateSnapshot | null>

  abstract createForTopic(
    topicId: string,
  ): Promise<TopicStateSnapshot | null>

  abstract applyVersionedPatch(input: {
    topicId: string
    expectedVersion: number
    patch: TopicStatePatch
  }): Promise<TopicStateSnapshot | null>
}

export const topicStateSelect = {
  id: true,
  topicId: true,
  version: true,
  requestKind: true,
  studentState: true,
  activeStrategy: true,
  primaryTechnique: true,
  supportingTechnique: true,
  guidanceLevel: true,
  revealPolicy: true,
  attemptCount: true,
  meaningfulAttemptCount: true,
  misconceptionStatus: true,
  learningStatus: true,
  resolutionEvidenceStrength: true,
  summary: true,
  lastTutorQuestion: true,
  lastStudentAction: true,
  resolved: true,
  updatedAt: true,
} satisfies Prisma.TopicStateSelect

@Injectable()
export class PrismaTopicStateRepository extends TopicStateRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async topicExists(topicId: string): Promise<boolean> {
    const topic = await this.prismaService.topic.findUnique({
      where: { id: topicId },
      select: { id: true },
    })

    return topic !== null
  }

  findByTopicId(topicId: string): Promise<TopicStateSnapshot | null> {
    return this.prismaService.topicState.findUnique({
      where: { topicId },
      select: topicStateSelect,
    })
  }

  async createForTopic(topicId: string): Promise<TopicStateSnapshot | null> {
    return this.prismaService.topicState
      .create({
        data: { topicId },
        select: topicStateSelect,
      })
      .catch((error: unknown) => {
        if (isUniqueConstraintError(error)) {
          return null
        }

        throw error
      })
  }

  async applyVersionedPatch(input: {
    topicId: string
    expectedVersion: number
    patch: TopicStatePatch
  }): Promise<TopicStateSnapshot | null> {
    const updated = await this.prismaService.topicState.updateManyAndReturn({
      where: {
        topicId: input.topicId,
        version: input.expectedVersion,
      },
      data: {
        ...topicStatePatchData(input.patch),
        version: { increment: 1 },
      },
      select: topicStateSelect,
      limit: 1,
    })

    return updated[0] ?? null
  }
}

function topicStatePatchData(
  patch: TopicStatePatch,
): Prisma.TopicStateUpdateManyMutationInput {
  const data: Prisma.TopicStateUpdateManyMutationInput = {}

  if ('requestKind' in patch) {
    data.requestKind = patch.requestKind
  }
  if ('studentState' in patch) {
    data.studentState = patch.studentState
  }
  if ('activeStrategy' in patch) {
    data.activeStrategy = patch.activeStrategy
  }
  if ('primaryTechnique' in patch) {
    data.primaryTechnique = patch.primaryTechnique
  }
  if ('supportingTechnique' in patch) {
    data.supportingTechnique = patch.supportingTechnique
  }
  if ('guidanceLevel' in patch) {
    data.guidanceLevel = patch.guidanceLevel
  }
  if ('revealPolicy' in patch) {
    data.revealPolicy = patch.revealPolicy
  }
  if ('attemptCount' in patch) {
    data.attemptCount = patch.attemptCount
  }
  if ('meaningfulAttemptCount' in patch) {
    data.meaningfulAttemptCount = patch.meaningfulAttemptCount
  }
  if ('misconceptionStatus' in patch) {
    data.misconceptionStatus = patch.misconceptionStatus
  }
  if ('learningStatus' in patch) {
    data.learningStatus = patch.learningStatus
  }
  if ('resolutionEvidenceStrength' in patch) {
    data.resolutionEvidenceStrength = patch.resolutionEvidenceStrength
  }
  if ('summary' in patch) {
    data.summary = patch.summary
  }
  if ('lastTutorQuestion' in patch) {
    data.lastTutorQuestion = patch.lastTutorQuestion
  }
  if ('lastStudentAction' in patch) {
    data.lastStudentAction = patch.lastStudentAction
  }
  if ('resolved' in patch) {
    data.resolved = patch.resolved
  }

  return data
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}
