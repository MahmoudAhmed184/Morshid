import { z } from 'zod'

export const notificationSchema = z
  .object({
    id: z.uuid(),
    reviewCaseId: z.uuid().nullable(),
    messageId: z.uuid().nullable(),
    sessionId: z.uuid().nullable(),
    type: z.enum(['REVIEW_RESOLVED', 'REVIEW_REJECTED', 'USAGE_LIMIT_REACHED']),
    status: z.enum(['UNREAD', 'READ', 'DISMISSED']),
    title: z.string(),
    body: z.string(),
    createdAt: z.iso.datetime({ offset: true }),
    readAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict()

export const notificationListSchema = z
  .object({
    items: z.array(notificationSchema),
    nextCursor: z.uuid().nullable(),
  })
  .strict()

export const unreadNotificationCountSchema = z
  .object({
    unreadCount: z.number().int().nonnegative(),
  })
  .strict()

export type Notification = z.infer<typeof notificationSchema>
export type NotificationList = z.infer<typeof notificationListSchema>
export type UnreadNotificationCount = z.infer<
  typeof unreadNotificationCountSchema
>
