import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/session/session.store'
import { markStudentReviewInboxItemRead } from './student-review-inbox.api'
import {
  studentReviewInboxKeys,
  studentReviewInboxListQueryOptions,
  unreadStudentReviewInboxCountQueryOptions,
} from './student-review-inbox.queries'

export function useStudentReviewInbox() {
  const userId = useAuthStore((state) => state.user?.id)
  return useInfiniteQuery({
    ...studentReviewInboxListQueryOptions(userId ?? 'anonymous'),
    enabled: userId !== undefined,
  })
}

export function useUnreadStudentReviewInboxCount() {
  const userId = useAuthStore((state) => state.user?.id)
  return useQuery({
    ...unreadStudentReviewInboxCountQueryOptions(userId ?? 'anonymous'),
    enabled: userId !== undefined,
  })
}

export function useMarkStudentReviewInboxItemRead() {
  const userId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (inboxItemId: string) => {
      if (!userId) throw new Error('An authenticated user is required.')
      return markStudentReviewInboxItemRead(inboxItemId)
    },
    onSuccess: async () => {
      if (!userId) return
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: studentReviewInboxKeys.list(userId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: studentReviewInboxKeys.unreadCount(userId),
          exact: true,
        }),
      ])
    },
  })
}
