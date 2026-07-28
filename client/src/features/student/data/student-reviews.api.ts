import { apiJson } from '@/features/auth/api/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/api/authenticated-api-client'
import {
  createStudentReviewRequestSchema,
  createStudentReviewResponseSchema,
} from '@/features/student/schemas/student-chat.schema'

interface RequestStudentReviewParams {
  messageId: string
  note: string | null
  idempotencyKey: string
  options?: ApiFetchOptions
}

export async function requestStudentReview({
  messageId,
  note,
  idempotencyKey,
  options = {},
}: RequestStudentReviewParams) {
  const body = createStudentReviewRequestSchema.parse({ note })
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
