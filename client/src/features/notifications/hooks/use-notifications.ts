import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/session/session.store'
import { markNotificationRead } from '@/features/notifications/data/notifications.api'
import {
  notificationKeys,
  notificationListQueryOptions,
  unreadNotificationCountQueryOptions,
} from '@/features/notifications/data/notifications.queries'

export function useNotifications() {
  const userId = useAuthStore((state) => state.user?.id)
  return useInfiniteQuery({
    ...notificationListQueryOptions(userId ?? 'anonymous'),
    enabled: userId !== undefined,
  })
}

export function useUnreadNotificationCount() {
  const userId = useAuthStore((state) => state.user?.id)
  return useQuery({
    ...unreadNotificationCountQueryOptions(userId ?? 'anonymous'),
    enabled: userId !== undefined,
  })
}

export function useMarkNotificationRead() {
  const userId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notificationId: string) => {
      if (!userId) throw new Error('An authenticated user is required.')
      return markNotificationRead(notificationId)
    },
    onSuccess: async () => {
      if (!userId) return
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: notificationKeys.list(userId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: notificationKeys.unreadCount(userId),
          exact: true,
        }),
      ])
    },
  })
}
