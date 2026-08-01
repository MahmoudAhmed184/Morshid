import { apiJson } from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import {
  instructorReviewDetailSchema,
  instructorReviewActionResponseSchema,
  instructorReviewQueueResponseSchema,
} from '@/features/instructor/schemas/instructor-review.schema'
import type {
  InstructorReviewDetail,
  InstructorReviewActionResponse,
  InstructorReviewOutcome,
  InstructorReviewQueueResponse,
} from '@/features/instructor/schemas/instructor-review.schema'

export interface ResolveReviewCaseRequest {
  expectedVersion: number
  outcome: Exclude<InstructorReviewOutcome, 'REQUEST_REJECTED'>
  content: string | null
  reason?: string | null
}

export interface RejectReviewCaseRequest {
  expectedVersion: number
  reason: string
}

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

export async function resolveReviewCase(
  reviewCaseId: string,
  request: ResolveReviewCaseRequest,
  idempotencyKey: string,
  options: ApiFetchOptions = {},
): Promise<InstructorReviewActionResponse> {
  return performReviewAction(
    reviewCaseId,
    'resolve',
    request,
    idempotencyKey,
    options,
  )
}

export async function rejectReviewCase(
  reviewCaseId: string,
  request: RejectReviewCaseRequest,
  idempotencyKey: string,
  options: ApiFetchOptions = {},
): Promise<InstructorReviewActionResponse> {
  return performReviewAction(
    reviewCaseId,
    'reject',
    request,
    idempotencyKey,
    options,
  )
}

async function performReviewAction(
  reviewCaseId: string,
  action: 'resolve' | 'reject',
  request: ResolveReviewCaseRequest | RejectReviewCaseRequest,
  idempotencyKey: string,
  options: ApiFetchOptions,
) {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Idempotency-Key', idempotencyKey)
  const response = await apiJson<unknown>(
    `/api/v1/instructor/reviews/${encodeURIComponent(reviewCaseId)}/${action}`,
    {
      ...options,
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    },
  )
  return instructorReviewActionResponseSchema.parse(response)
}
