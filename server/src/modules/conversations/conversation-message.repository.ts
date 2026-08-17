import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../platform/database/prisma.service'
import {
  chatMessageSelect,
  ownedActiveSessionWhere,
} from './conversation-repository.support'
import type {
  ChatMessageRecord,
  MessageListPagination,
} from './interface/conversation-records'

export abstract class ConversationMessageRepository {
  abstract listMessages(
    courseId: string,
    sessionId: string,
    studentId: string,
    pagination: MessageListPagination,
  ): Promise<ChatMessageRecord[] | null>
}

@Injectable()
export class PrismaConversationMessageRepository extends ConversationMessageRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async listMessages(
    courseId: string,
    sessionId: string,
    studentId: string,
    pagination: MessageListPagination,
  ): Promise<ChatMessageRecord[] | null> {
    const session = await this.prismaService.chatSession.findFirst({
      where: ownedActiveSessionWhere(courseId, sessionId, studentId),
      select: {
        id: true,
      },
    })

    if (session === null) {
      return null
    }

    const before = pagination.before
    const isLoadingLatestOrEarlier =
      pagination.latest === true || (before !== undefined && before !== null)
    const sequenceFilter =
      pagination.after !== undefined && pagination.after !== null
        ? { gt: pagination.after }
        : before !== undefined && before !== null
          ? { lt: before }
          : undefined
    const messages = await this.prismaService.message.findMany({
      where: {
        sessionId: session.id,
        ...(sequenceFilter === undefined ? {} : { sequence: sequenceFilter }),
      },
      select: chatMessageSelect,
      orderBy: {
        sequence: isLoadingLatestOrEarlier ? 'desc' : 'asc',
      },
      take: pagination.limit,
    })

    return isLoadingLatestOrEarlier ? messages.reverse() : messages
  }
}
