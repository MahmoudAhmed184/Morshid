import { apiJson } from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import {
  createStudentReviewRequestSchema,
  createStudentReviewResponseSchema,
  studentReviewDetailSchema,
} from '@/features/reviews/interface/student-review.schema'
import type { StudentFlagReason } from '@/features/reviews/interface/student-review.schema'

interface RequestStudentReviewParams {
  messageId: string
  flagReason: StudentFlagReason
  note: string | null
  idempotencyKey: string
  options?: ApiFetchOptions
}

interface GetStudentReviewDetailParams {
  reviewCaseId: string
  options?: ApiFetchOptions
}

export async function getStudentReviewDetail({
  reviewCaseId,
  options = {},
}: GetStudentReviewDetailParams) {
  const response = await apiJson<unknown>(
    `/api/v1/student/reviews/${reviewCaseId}`,
    { ...options, method: 'GET' },
  )

  return studentReviewDetailSchema.parse(response)
}

export async function requestStudentReview({
  messageId,
  flagReason,
  note,
  idempotencyKey,
  options = {},
}: RequestStudentReviewParams) {
  const body = createStudentReviewRequestSchema.parse({ flagReason, note })
  const response = await apiJson<unknown>(
    `/api/v1/messages/${messageId}/review-requests`,
    {
      ...options,
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        ...options.headers,
      },
      method: 'POST',
    },
  )
  return createStudentReviewResponseSchema.parse(response)
}
