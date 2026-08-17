import { z } from 'zod'

export const studentReviewInboxItemSchema = z
  .object({
    id: z.uuid(),
    reviewCaseId: z.uuid(),
    courseId: z.uuid(),
    sessionId: z.uuid(),
    messageId: z.uuid(),
    type: z.enum(['REVIEW_RESOLVED', 'REVIEW_REJECTED']),
    status: z.enum(['UNREAD', 'READ']),
    title: z.string(),
    body: z.string(),
    createdAt: z.iso.datetime({ offset: true }),
    readAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict()

export const studentReviewInboxListSchema = z
  .object({
    items: z.array(studentReviewInboxItemSchema),
    nextCursor: z.uuid().nullable(),
  })
  .strict()

export const unreadStudentReviewInboxCountSchema = z
  .object({
    unreadCount: z.number().int().nonnegative(),
  })
  .strict()

export type StudentReviewInboxItem = z.infer<
  typeof studentReviewInboxItemSchema
>
export type StudentReviewInboxList = z.infer<
  typeof studentReviewInboxListSchema
>
export type UnreadStudentReviewInboxCount = z.infer<
  typeof unreadStudentReviewInboxCountSchema
>
