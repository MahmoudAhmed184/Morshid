import { apiJson } from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import {
  notificationListSchema,
  notificationSchema,
  unreadNotificationCountSchema,
} from '@/features/notifications/schemas/notification.schema'

interface GetNotificationsParams {
  cursor?: string | null
  limit?: number
  options?: ApiFetchOptions
}

export async function getNotifications({
  cursor = null,
  limit = 25,
  options = {},
}: GetNotificationsParams = {}) {
  const search = new URLSearchParams({ limit: String(limit) })
  if (cursor !== null) search.set('cursor', cursor)

  const response = await apiJson<unknown>(
    `/api/v1/notifications?${search.toString()}`,
    { ...options, method: 'GET' },
  )
  return notificationListSchema.parse(response)
}

export async function getUnreadNotificationCount(
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    '/api/v1/notifications/unread-count',
    { ...options, method: 'GET' },
  )
  return unreadNotificationCountSchema.parse(response)
}

export async function markNotificationRead(
  notificationId: string,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
    { ...options, method: 'POST' },
  )
  return notificationSchema.parse(response)
}
