import { Injectable } from '@nestjs/common'

import {
  NotificationStatus,
  type NotificationType,
  Prisma,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export interface NotificationRecord {
  id: string
  reviewCaseId: string | null
  messageId: string | null
  sessionId: string | null
  type: NotificationType
  status: NotificationStatus
  createdAt: Date
  readAt: Date | null
}

export interface NotificationPage {
  records: NotificationRecord[]
  nextCursor: string | null
}

export abstract class NotificationsRepository {
  abstract list(
    recipientUserId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<NotificationPage>

  abstract countUnread(recipientUserId: string): Promise<number>

  abstract markRead(
    recipientUserId: string,
    notificationId: string,
  ): Promise<NotificationRecord | null>
}

@Injectable()
export class PrismaNotificationsRepository extends NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async list(
    recipientUserId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<NotificationPage> {
    const records = await this.prisma.notification.findMany({
      where: { recipientUserId, dismissedAt: null },
      select: notificationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    })
    const hasNextPage = records.length > limit
    const page = hasNextPage ? records.slice(0, limit) : records
    return {
      records: page.map(mapRecord),
      nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
    }
  }

  countUnread(recipientUserId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { recipientUserId, status: NotificationStatus.UNREAD },
    })
  }

  markRead(
    recipientUserId: string,
    notificationId: string,
  ): Promise<NotificationRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const notification = await tx.notification.findFirst({
        where: { id: notificationId, recipientUserId },
        select: notificationSelect,
      })
      if (notification === null) return null
      if (notification.status !== NotificationStatus.UNREAD) {
        return mapRecord(notification)
      }

      await tx.notification.updateMany({
        where: {
          id: notificationId,
          recipientUserId,
          status: NotificationStatus.UNREAD,
          readAt: null,
        },
        data: { status: NotificationStatus.READ, readAt: new Date() },
      })
      const updated = await tx.notification.findFirst({
        where: { id: notificationId, recipientUserId },
        select: notificationSelect,
      })
      return updated === null ? null : mapRecord(updated)
    })
  }
}

const notificationSelect = {
  id: true,
  reviewCaseId: true,
  type: true,
  status: true,
  createdAt: true,
  readAt: true,
  reviewCase: {
    select: {
      targetMessage: {
        select: { id: true, sessionId: true },
      },
    },
  },
} satisfies Prisma.NotificationSelect

function mapRecord(
  record: Prisma.NotificationGetPayload<{
    select: typeof notificationSelect
  }>,
): NotificationRecord {
  return {
    id: record.id,
    reviewCaseId: record.reviewCaseId,
    messageId: record.reviewCase?.targetMessage.id ?? null,
    sessionId: record.reviewCase?.targetMessage.sessionId ?? null,
    type: record.type,
    status: record.status,
    createdAt: record.createdAt,
    readAt: record.readAt,
  }
}
