import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  instructorReviewDetailQueryOptions,
  instructorReviewQueueQueryOptions,
} from '@/features/instructor/data/instructor-reviews.queries'

export function useInstructorReviewQueue() {
  const instructorId = useAuthStore((state) => state.user?.id)
  return useInfiniteQuery({
    ...instructorReviewQueueQueryOptions(instructorId ?? 'anonymous'),
    enabled: instructorId !== undefined,
  })
}

export function useInstructorReviewDetail(reviewCaseId: string) {
  const instructorId = useAuthStore((state) => state.user?.id)
  return useQuery({
    ...instructorReviewDetailQueryOptions(
      instructorId ?? 'anonymous',
      reviewCaseId,
    ),
    enabled: instructorId !== undefined,
  })
}
