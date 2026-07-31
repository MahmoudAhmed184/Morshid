import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import {
  instructorReviewDetailQueryOptions,
  instructorReviewKeys,
  instructorReviewQueueQueryOptions,
} from '@/features/instructor/data/instructor-reviews.queries'
import {
  rejectReviewCase,
  resolveReviewCase,
} from '@/features/instructor/data/instructor-reviews.api'
import type {
  RejectReviewCaseRequest,
  ResolveReviewCaseRequest,
} from '@/features/instructor/data/instructor-reviews.api'

interface InstructorReviewActionVariables<TRequest> {
  reviewCaseId: string
  idempotencyKey: string
  request: TRequest
}

export type ResolveInstructorReviewVariables =
  InstructorReviewActionVariables<ResolveReviewCaseRequest>

export type RejectInstructorReviewVariables =
  InstructorReviewActionVariables<RejectReviewCaseRequest>

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

export function useResolveInstructorReview() {
  return useInstructorReviewAction(resolveReviewCase)
}

export function useRejectInstructorReview() {
  return useInstructorReviewAction(rejectReviewCase)
}

function useInstructorReviewAction<TRequest>(
  action: (
    reviewCaseId: string,
    request: TRequest,
    idempotencyKey: string,
  ) => ReturnType<typeof resolveReviewCase>,
) {
  const instructorId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: InstructorReviewActionVariables<TRequest>) => {
      if (!instructorId) {
        throw new Error('An authenticated Instructor is required.')
      }
      return action(
        variables.reviewCaseId,
        variables.request,
        variables.idempotencyKey,
      )
    },
    onSuccess: async (_response, { reviewCaseId }) => {
      if (!instructorId) return
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: instructorReviewKeys.detail(instructorId, reviewCaseId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: instructorReviewKeys.queue(instructorId),
          exact: true,
        }),
      ])
    },
  })
}
