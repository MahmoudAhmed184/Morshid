import { z } from 'zod'

export const studentReviewSummarySchema = z
  .object({
    reviewCaseId: z.uuid(),
    status: z.enum(['PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED']),
    outcome: z
      .enum(['APPROVED', 'EDITED', 'REPLACED', 'REQUEST_REJECTED'])
      .nullable(),
    resolvedAt: z.iso.datetime().nullable(),
  })
  .strict()

export const studentReviewDetailSchema = z
  .object({
    reviewCaseId: z.uuid(),
    status: z.enum(['PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED']),
    outcome: z
      .enum(['APPROVED', 'EDITED', 'REPLACED', 'REQUEST_REJECTED'])
      .nullable(),
    publishedContent: z.string().nullable(),
    rejectionReason: z.string().nullable(),
    requestedAt: z.iso.datetime(),
    resolvedAt: z.iso.datetime().nullable(),
    messageId: z.uuid(),
    sessionId: z.uuid(),
  })
  .strict()

export const studentFlagReasonSchema = z.enum([
  'INCORRECT',
  'CONFUSING',
  'UNHELPFUL',
  'COURSE_MISMATCH',
  'TOO_MUCH_ANSWER',
  'OTHER',
])

export const createStudentReviewRequestSchema = z
  .object({
    flagReason: studentFlagReasonSchema,
    note: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim() || null : value),
      z.string().max(200).nullable(),
    ),
  })
  .strict()
  .superRefine(({ flagReason, note }, context) => {
    if (flagReason === 'OTHER' && note === null) {
      context.addIssue({
        code: 'custom',
        message: 'Add a note when selecting Other',
        path: ['note'],
      })
    }
  })

export const createStudentReviewResponseSchema = z
  .object({
    caseId: z.uuid(),
    messageId: z.uuid(),
    status: z.literal('PENDING'),
    trigger: z.literal('STUDENT_REQUEST'),
    requestedAt: z.iso.datetime(),
    replayed: z.boolean(),
    reviewSummary: z
      .object({
        status: z.literal('PENDING'),
        outcome: z.null(),
        resolvedAt: z.null(),
        reviewCaseId: z.uuid(),
      })
      .strict(),
  })
  .strict()

export type StudentFlagReason = z.infer<typeof studentFlagReasonSchema>
export type CreateStudentReviewRequest = z.infer<
  typeof createStudentReviewRequestSchema
>
export type CreateStudentReviewResponse = z.infer<
  typeof createStudentReviewResponseSchema
>
export type StudentReviewDetail = z.infer<typeof studentReviewDetailSchema>
