import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'

import {
  getInstructorReview,
  listInstructorReviews,
} from '@/features/instructor/data/instructor-reviews.api'

export const instructorReviewKeys = {
  all: (instructorId: string) =>
    ['instructor', instructorId, 'reviews'] as const,
  queue: (instructorId: string) =>
    [...instructorReviewKeys.all(instructorId), 'queue'] as const,
  detail: (instructorId: string, reviewCaseId: string) =>
    [
      ...instructorReviewKeys.all(instructorId),
      'detail',
      reviewCaseId,
    ] as const,
}

export function instructorReviewQueueQueryOptions(instructorId: string) {
  return infiniteQueryOptions({
    queryKey: instructorReviewKeys.queue(instructorId),
    queryFn: ({ pageParam, signal }) =>
      listInstructorReviews(pageParam, { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
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
  })
}
