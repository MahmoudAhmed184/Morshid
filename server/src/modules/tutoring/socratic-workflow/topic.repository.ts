import { Injectable } from '@nestjs/common'

import {
  MessageRole,
  Prisma,
  TopicStatus,
  TopicType,
} from '../../../generated/prisma/client'
import { PrismaService } from '../../../platform/database/prisma.service'
import type {
  ActiveTopicReplacementResult,
  TopicRecord,
  TopicScope,
  TopicSessionRecord,
} from './topic.types'

export interface CreateTopicRecordInput extends TopicScope {
  title: string
  problemId: string | null
  conceptId: string | null
  topicType: TopicType
}

export interface ActivateTopicInput extends TopicScope {
  topicId: string
  expectedStatus: typeof TopicStatus.PAUSED | typeof TopicStatus.RESOLVED
  clearResolvedAt: boolean
}

export abstract class TopicRepository {
  abstract findAuthoritativeSession(
    sessionId: string,
  ): Promise<TopicSessionRecord | null>

  abstract findActiveTopics(scope: TopicScope): Promise<TopicRecord[]>

  abstract findTopicsByProblemId(
    scope: TopicScope,
    problemId: string,
  ): Promise<TopicRecord[]>

  abstract findTopicsByConceptId(
    scope: TopicScope,
    conceptId: string,
  ): Promise<TopicRecord[]>

  abstract findTopicById(
    scope: TopicScope,
    topicId: string,
  ): Promise<TopicRecord | null>

  abstract createActiveTopic(
    input: CreateTopicRecordInput,
  ): Promise<ActiveTopicReplacementResult | null>

  abstract activateTopic(
    input: ActivateTopicInput,
  ): Promise<ActiveTopicReplacementResult | null>

  abstract pauseTopic(
    scope: TopicScope,
    topicId: string,
  ): Promise<TopicRecord | null>

  abstract resolveTopic(
    scope: TopicScope,
    topicId: string,
    resolvedAt: Date,
  ): Promise<TopicRecord | null>

  abstract countMessagesByIds(
    scope: TopicScope,
    messageIds: string[],
  ): Promise<number>
}

const topicSelect = {
  id: true,
  sessionId: true,
  courseId: true,
  problemId: true,
  conceptId: true,
  title: true,
  topicType: true,
  status: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TopicSelect

@Injectable()
export class PrismaTopicRepository extends TopicRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  findAuthoritativeSession(
    sessionId: string,
  ): Promise<TopicSessionRecord | null> {
    return this.prismaService.chatSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        courseId: true,
        deletedAt: true,
      },
    })
  }

  findActiveTopics(scope: TopicScope): Promise<TopicRecord[]> {
    return this.prismaService.topic.findMany({
      where: {
        sessionId: scope.sessionId,
        courseId: scope.courseId,
        status: TopicStatus.ACTIVE,
      },
      select: topicSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 3,
    })
  }

  findTopicsByProblemId(
    scope: TopicScope,
    problemId: string,
  ): Promise<TopicRecord[]> {
    return this.prismaService.topic.findMany({
      where: {
        sessionId: scope.sessionId,
        courseId: scope.courseId,
        problemId,
      },
      select: topicSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    })
  }

  findTopicsByConceptId(
    scope: TopicScope,
    conceptId: string,
  ): Promise<TopicRecord[]> {
    return this.prismaService.topic.findMany({
      where: {
        sessionId: scope.sessionId,
        courseId: scope.courseId,
        conceptId,
      },
      select: topicSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    })
  }

  findTopicById(
    scope: TopicScope,
    topicId: string,
  ): Promise<TopicRecord | null> {
    return this.prismaService.topic.findFirst({
      where: {
        id: topicId,
        sessionId: scope.sessionId,
        courseId: scope.courseId,
      },
      select: topicSelect,
    })
  }

  createActiveTopic(
    input: CreateTopicRecordInput,
  ): Promise<ActiveTopicReplacementResult | null> {
    return this.prismaService.$transaction(async (tx) => {
      const activeTopics = await this.findActiveTopicsInTransaction(tx, input)

      if (activeTopics.length > 1) {
        return null
      }

      const previousTopicId =
        activeTopics.length === 1 ? activeTopics[0].id : null

      if (previousTopicId !== null) {
        await tx.topic.updateMany({
          where: {
            id: previousTopicId,
            sessionId: input.sessionId,
            courseId: input.courseId,
            status: TopicStatus.ACTIVE,
          },
          data: {
            status: TopicStatus.PAUSED,
          },
        })
      }

      const topic = await tx.topic.create({
        data: {
          sessionId: input.sessionId,
          courseId: input.courseId,
          problemId: input.problemId,
          conceptId: input.conceptId,
          title: input.title,
          topicType: input.topicType,
          status: TopicStatus.ACTIVE,
        },
        select: topicSelect,
      })

      return { topic, previousTopicId }
    })
  }

  activateTopic(
    input: ActivateTopicInput,
  ): Promise<ActiveTopicReplacementResult | null> {
    return this.prismaService.$transaction(async (tx) => {
      const selected = await tx.topic.findFirst({
        where: {
          id: input.topicId,
          sessionId: input.sessionId,
          courseId: input.courseId,
        },
        select: topicSelect,
      })

      if (selected === null) {
        return null
      }

      if (selected.status === TopicStatus.ACTIVE) {
        const activeTopics = await this.findActiveTopicsInTransaction(tx, input)
        const differentActiveTopics = activeTopics.filter(
          (topic) => topic.id !== selected.id,
        )

        if (differentActiveTopics.length > 0) {
          return null
        }

        return {
          topic: selected,
          previousTopicId: null,
        }
      }

      if (selected.status !== input.expectedStatus) {
        return null
      }

      const activeTopics = await this.findActiveTopicsInTransaction(tx, input)

      if (activeTopics.length > 1) {
        return null
      }

      const previousTopicId =
        activeTopics.length === 1 ? activeTopics[0].id : null

      if (previousTopicId !== null && previousTopicId !== selected.id) {
        await tx.topic.updateMany({
          where: {
            id: previousTopicId,
            sessionId: input.sessionId,
            courseId: input.courseId,
            status: TopicStatus.ACTIVE,
          },
          data: {
            status: TopicStatus.PAUSED,
          },
        })
      }

      const updated = await tx.topic.updateManyAndReturn({
        where: {
          id: selected.id,
          sessionId: input.sessionId,
          courseId: input.courseId,
          status: input.expectedStatus,
        },
        data: {
          status: TopicStatus.ACTIVE,
          ...(input.clearResolvedAt ? { resolvedAt: null } : {}),
        },
        select: topicSelect,
        limit: 1,
      })

      return updated.length === 0
        ? null
        : {
            topic: updated[0],
            previousTopicId:
              previousTopicId === selected.id ? null : previousTopicId,
          }
    })
  }

  async pauseTopic(
    scope: TopicScope,
    topicId: string,
  ): Promise<TopicRecord | null> {
    const updated = await this.prismaService.topic.updateManyAndReturn({
      where: {
        id: topicId,
        sessionId: scope.sessionId,
        courseId: scope.courseId,
        status: TopicStatus.ACTIVE,
      },
      data: {
        status: TopicStatus.PAUSED,
      },
      select: topicSelect,
      limit: 1,
    })

    return updated[0] ?? null
  }

  async resolveTopic(
    scope: TopicScope,
    topicId: string,
    resolvedAt: Date,
  ): Promise<TopicRecord | null> {
    const updated = await this.prismaService.topic.updateManyAndReturn({
      where: {
        id: topicId,
        sessionId: scope.sessionId,
        courseId: scope.courseId,
        status: TopicStatus.ACTIVE,
      },
      data: {
        status: TopicStatus.RESOLVED,
        resolvedAt,
      },
      select: topicSelect,
      limit: 1,
    })

    return updated[0] ?? null
  }

  countMessagesByIds(scope: TopicScope, messageIds: string[]): Promise<number> {
    return this.prismaService.message.count({
      where: {
        id: { in: messageIds },
        sessionId: scope.sessionId,
        role: MessageRole.STUDENT,
      },
    })
  }

  private findActiveTopicsInTransaction(
    tx: Prisma.TransactionClient,
    scope: TopicScope,
  ): Promise<TopicRecord[]> {
    return tx.topic.findMany({
      where: {
        sessionId: scope.sessionId,
        courseId: scope.courseId,
        status: TopicStatus.ACTIVE,
      },
      select: topicSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 3,
    })
  }
}
