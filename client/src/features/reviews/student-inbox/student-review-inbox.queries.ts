import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import {
  getStudentReviewInbox,
  getUnreadStudentReviewInboxCount,
} from './student-review-inbox.api'
import { visibilityAwarePollingInterval } from '@/lib/query/polling'

export const studentReviewInboxKeys = {
  all: (userId: string) => ['student-review-inbox', userId] as const,
  list: (userId: string) =>
    [...studentReviewInboxKeys.all(userId), 'list'] as const,
  unreadCount: (userId: string) =>
    [...studentReviewInboxKeys.all(userId), 'unread-count'] as const,
}

export function studentReviewInboxListQueryOptions(userId: string) {
  return infiniteQueryOptions({
    queryKey: studentReviewInboxKeys.list(userId),
    queryFn: ({ pageParam, signal }) =>
      getStudentReviewInbox({ cursor: pageParam, options: { signal } }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  })
}

export function unreadStudentReviewInboxCountQueryOptions(userId: string) {
  return queryOptions({
    queryKey: studentReviewInboxKeys.unreadCount(userId),
    queryFn: ({ signal }) => getUnreadStudentReviewInboxCount({ signal }),
    staleTime: 30_000,
    refetchInterval: () => visibilityAwarePollingInterval(),
    refetchIntervalInBackground: true,
  })
}
