import { Injectable } from '@nestjs/common'

import { NotificationType } from '../../generated/prisma/client'
import type { AuthenticatedUser } from '../identity/identity.types'
import type {
  NotificationListQuery,
  NotificationListResponseDto,
  NotificationUnreadCountDto,
  StudentNotificationDto,
} from './notifications.dto'
import { notificationNotFoundException } from './notifications.errors'
import {
  NotificationsRepository,
  type NotificationRecord,
} from './notifications.repository'

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  async list(
    user: AuthenticatedUser,
    query: NotificationListQuery,
  ): Promise<NotificationListResponseDto> {
    const page = await this.repository.list(user.id, query.cursor, query.limit)
    return {
      items: page.records.map(presentNotification),
      nextCursor: page.nextCursor,
    }
  }

  async unreadCount(
    user: AuthenticatedUser,
  ): Promise<NotificationUnreadCountDto> {
    return { unreadCount: await this.repository.countUnread(user.id) }
  }

  async markRead(
    user: AuthenticatedUser,
    notificationId: string,
  ): Promise<StudentNotificationDto> {
    const notification = await this.repository.markRead(user.id, notificationId)
    if (notification === null) throw notificationNotFoundException()
    return presentNotification(notification)
  }
}

function presentNotification(
  notification: NotificationRecord,
): StudentNotificationDto {
  const copy = notificationCopy(notification.type)
  return {
    id: notification.id,
    reviewCaseId: notification.reviewCaseId,
    messageId: notification.messageId,
    sessionId: notification.sessionId,
    type: notification.type,
    status: notification.status,
    ...copy,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
  }
}

function notificationCopy(type: NotificationType) {
  switch (type) {
    case NotificationType.REVIEW_RESOLVED:
      return {
        title: 'Instructor review completed',
        body: 'Your review request has been resolved.',
      }
    case NotificationType.REVIEW_REJECTED:
      return {
        title: 'Review request update',
        body: 'Your review request was rejected.',
      }
    case NotificationType.USAGE_LIMIT_REACHED:
      return {
        title: 'Usage limit reached',
        body: 'You have reached a usage limit.',
      }
  }
}
