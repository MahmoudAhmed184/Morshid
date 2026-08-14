import { apiJson } from '@/features/auth/session/interface/authenticated-api-client'
import type { ApiFetchOptions } from '@/features/auth/session/interface/authenticated-api-client'
import {
  studentReviewInboxItemSchema,
  studentReviewInboxListSchema,
  unreadStudentReviewInboxCountSchema,
} from './student-review-inbox.schema'

interface GetStudentReviewInboxParams {
  cursor?: string | null
  limit?: number
  options?: ApiFetchOptions
}

export async function getStudentReviewInbox({
  cursor = null,
  limit = 25,
  options = {},
}: GetStudentReviewInboxParams = {}) {
  const search = new URLSearchParams({ limit: String(limit) })
  if (cursor !== null) search.set('cursor', cursor)

  const response = await apiJson<unknown>(
    `/api/v1/reviews/inbox?${search.toString()}`,
    { ...options, method: 'GET' },
  )
  return studentReviewInboxListSchema.parse(response)
}

export async function getUnreadStudentReviewInboxCount(
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    '/api/v1/reviews/inbox/unread-count',
    { ...options, method: 'GET' },
  )
  return unreadStudentReviewInboxCountSchema.parse(response)
}

export async function markStudentReviewInboxItemRead(
  inboxItemId: string,
  options: ApiFetchOptions = {},
) {
  const response = await apiJson<unknown>(
    `/api/v1/reviews/inbox/${encodeURIComponent(inboxItemId)}/read`,
    { ...options, method: 'POST' },
  )
  return studentReviewInboxItemSchema.parse(response)
}
