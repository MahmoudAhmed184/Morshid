import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import {
  getInstructorReview,
  listInstructorReviews,
} from '@/features/instructor/data/instructor-reviews.api'
import type { StudentFlagReason } from '@/features/instructor/schemas/instructor-review.schema'
import { visibilityAwarePollingInterval } from '@/lib/query/polling'

export const instructorReviewKeys = {
  all: (instructorId: string) =>
    ['instructor', instructorId, 'reviews'] as const,
  queue: (instructorId: string) =>
    [...instructorReviewKeys.all(instructorId), 'queue'] as const,
  queueFiltered: (
    instructorId: string,
    studentFlagReason: StudentFlagReason | null,
  ) =>
    [
      ...instructorReviewKeys.queue(instructorId),
      { studentFlagReason },
    ] as const,
  detail: (instructorId: string, reviewCaseId: string) =>
    [
      ...instructorReviewKeys.all(instructorId),
      'detail',
      reviewCaseId,
    ] as const,
}

export function instructorReviewQueueQueryOptions(
  instructorId: string,
  studentFlagReason: StudentFlagReason | null = null,
) {
  return infiniteQueryOptions({
    queryKey: instructorReviewKeys.queueFiltered(
      instructorId,
      studentFlagReason,
    ),
    queryFn: ({ pageParam, signal }) =>
      listInstructorReviews(pageParam, studentFlagReason, { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    refetchInterval: () => visibilityAwarePollingInterval(),
    refetchIntervalInBackground: true,
  })
}

export function instructorReviewDetailQueryOptions(
  instructorId: string,
  reviewCaseId: string,
) {
  return queryOptions({
    queryKey: instructorReviewKeys.detail(instructorId, reviewCaseId),
    queryFn: ({ signal }) => getInstructorReview(reviewCaseId, { signal }),
    staleTime: 30_000,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'PENDING' || status === 'IN_REVIEW'
        ? visibilityAwarePollingInterval()
        : false
    },
    refetchIntervalInBackground: true,
  })
}
