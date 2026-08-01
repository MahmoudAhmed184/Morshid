import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import {
  getNotifications,
  getUnreadNotificationCount,
} from '@/features/notifications/data/notifications.api'

export const notificationKeys = {
  all: (userId: string) => ['notifications', userId] as const,
  list: (userId: string) => [...notificationKeys.all(userId), 'list'] as const,
  unreadCount: (userId: string) =>
    [...notificationKeys.all(userId), 'unread-count'] as const,
}

export function notificationListQueryOptions(userId: string) {
  return infiniteQueryOptions({
    queryKey: notificationKeys.list(userId),
    queryFn: ({ pageParam, signal }) =>
      getNotifications({ cursor: pageParam, options: { signal } }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  })
}

export function unreadNotificationCountQueryOptions(userId: string) {
  return queryOptions({
    queryKey: notificationKeys.unreadCount(userId),
    queryFn: ({ signal }) => getUnreadNotificationCount({ signal }),
    staleTime: 30_000,
  })
}
