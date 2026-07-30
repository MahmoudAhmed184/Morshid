import { apiJson } from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import {
  instructorReviewDetailSchema,
  instructorReviewQueueResponseSchema,
} from '@/features/instructor/schemas/instructor-review.schema'
import type {
  InstructorReviewDetail,
  InstructorReviewQueueResponse,
} from '@/features/instructor/schemas/instructor-review.schema'

export async function listInstructorReviews(
  cursor: string | null,
  options: ApiFetchOptions = {},
): Promise<InstructorReviewQueueResponse> {
  const search = new URLSearchParams({ limit: '25' })
  if (cursor !== null) search.set('cursor', cursor)
  const response = await apiJson<unknown>(
    `/api/v1/instructor/reviews?${search.toString()}`,
    { ...options, method: 'GET' },
  )
  return instructorReviewQueueResponseSchema.parse(response)
}

export async function getInstructorReview(
  reviewCaseId: string,
  options: ApiFetchOptions = {},
): Promise<InstructorReviewDetail> {
  const response = await apiJson<unknown>(
    `/api/v1/instructor/reviews/${encodeURIComponent(reviewCaseId)}`,
    { ...options, method: 'GET' },
  )
  return instructorReviewDetailSchema.parse(response)
}
