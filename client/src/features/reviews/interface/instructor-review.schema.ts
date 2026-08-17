import { z } from 'zod'

const reviewStatusSchema = z.enum([
  'PENDING',
  'IN_REVIEW',
  'RESOLVED',
  'REJECTED',
])

export const instructorReviewOutcomeSchema = z.enum([
  'APPROVED',
  'EDITED',
  'REPLACED',
  'REQUEST_REJECTED',
])

const reviewTriggerSchema = z.enum([
  'STUDENT_REQUEST',
  'GENERAL_NOT_FOUND',
  'CITATION_MISSING',
  'SOURCE_CONFLICT',
  'POLICY_CHECK_FAILED',
  'FINAL_ANSWER_RISK',
])

export const studentFlagReasonSchema = z.enum([
  'INCORRECT',
  'CONFUSING',
  'UNHELPFUL',
  'COURSE_MISMATCH',
  'TOO_MUCH_ANSWER',
  'OTHER',
])

const reviewCourseSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  title: z.string(),
})

const reviewStudentSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
})

export const instructorReviewQueueItemSchema = z.object({
  reviewCaseId: z.uuid(),
  status: reviewStatusSchema,
  trigger: reviewTriggerSchema,
  triggers: z.array(reviewTriggerSchema).min(1),
  studentFlagReason: studentFlagReasonSchema.nullable(),
  studentNote: z.string().max(200).nullable(),
  createdAt: z.iso.datetime(),
  age: z.number().int().nonnegative(),
  course: reviewCourseSchema,
  student: reviewStudentSchema,
  pending: z.boolean(),
})

export const instructorReviewQueueResponseSchema = z.object({
  items: z.array(instructorReviewQueueItemSchema),
  pendingCount: z.number().int().nonnegative(),
  nextCursor: z.uuid().nullable(),
})

const reviewMessageSchema = z.object({
  role: z.enum(['STUDENT', 'ASSISTANT', 'SYSTEM']),
  content: z.string(),
  createdAt: z.iso.datetime(),
})

const reviewExchangeSchema = z.object({
  studentMessage: reviewMessageSchema.nullable(),
  assistantResponse: reviewMessageSchema.nullable(),
})

const reviewCitationSchema = z.object({
  order: z.number().int().positive(),
  materialId: z.uuid(),
  materialTitle: z.string(),
  snippets: z.array(
    z.object({
      chunkNumber: z.number().int().positive(),
      excerpt: z.string().max(500),
    }),
  ),
})

const reviewActionHistorySchema = z.object({
  type: z.enum([
    'CREATED',
    'TRIGGER_ADDED',
    'CLAIMED',
    'DRAFT_SAVED',
    'APPROVED',
    'EDITED',
    'REPLACED',
    'REJECTED',
  ]),
  actorDisplayName: z.string().nullable(),
  content: z.string().nullable(),
  reason: z.string().max(1000).nullable(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
})

export const instructorReviewDetailSchema = z.object({
  reviewCaseId: z.uuid(),
  status: reviewStatusSchema,
  version: z.number().int().positive(),
  canReject: z.boolean(),
  trigger: reviewTriggerSchema,
  triggers: z.array(reviewTriggerSchema).min(1),
  studentFlagReason: studentFlagReasonSchema.nullable(),
  createdAt: z.iso.datetime(),
  requestedAt: z.iso.datetime(),
  studentNote: z.string().max(200).nullable(),
  course: reviewCourseSchema,
  student: reviewStudentSchema,
  flaggedExchange: reviewMessageSchema,
  assistantResponse: reviewMessageSchema.extend({
    citations: z.array(reviewCitationSchema),
  }),
  previousExchange: reviewExchangeSchema.nullable(),
  followingExchange: reviewExchangeSchema.nullable(),
  actions: z.array(reviewActionHistorySchema).default([]),
  reviewSummary: z.object({
    status: reviewStatusSchema,
    outcome: z
      .enum(['APPROVED', 'EDITED', 'REPLACED', 'REQUEST_REJECTED'])
      .nullable(),
    resolvedAt: z.iso.datetime().nullable(),
    reviewCaseId: z.uuid(),
  }),
})

export const instructorReviewActionResponseSchema = z.object({
  reviewCaseId: z.uuid(),
  status: z.enum(['RESOLVED', 'REJECTED']),
  outcome: instructorReviewOutcomeSchema,
  publishedContent: z.string().nullable(),
  resolutionReason: z.string().max(500).nullable(),
  version: z.number().int().min(2),
  resolvedAt: z.iso.datetime(),
  replayed: z.boolean(),
})

export type InstructorReviewQueueItem = z.infer<
  typeof instructorReviewQueueItemSchema
>
export type StudentFlagReason = z.infer<typeof studentFlagReasonSchema>
export type InstructorReviewQueueResponse = z.infer<
  typeof instructorReviewQueueResponseSchema
>
export type InstructorReviewDetail = z.infer<
  typeof instructorReviewDetailSchema
>
export type InstructorReviewExchange = z.infer<typeof reviewExchangeSchema>
export type InstructorReviewActionResponse = z.infer<
  typeof instructorReviewActionResponseSchema
>
export type InstructorReviewOutcome = z.infer<
  typeof instructorReviewOutcomeSchema
>

export const reasonCountSchema = z.object({
  reason: studentFlagReasonSchema,
  count: z.number().int().nonnegative(),
})

export const triggerCountSchema = z.object({
  trigger: reviewTriggerSchema,
  count: z.number().int().nonnegative(),
})

export const instructorReviewWorkloadSummarySchema = z.object({
  pendingCount: z.number().int().nonnegative(),
  inReviewCount: z.number().int().nonnegative(),
  claimedByMeCount: z.number().int().nonnegative(),
  totalActiveCount: z.number().int().nonnegative(),
  oldestPendingCreatedAt: z.iso.datetime().nullable(),
  oldestPendingAge: z.number().int().nonnegative().nullable(),
  byStudentFlagReason: z.array(reasonCountSchema),
  byTriggerType: z.array(triggerCountSchema),
})

export type ReasonCount = z.infer<typeof reasonCountSchema>
export type TriggerCount = z.infer<typeof triggerCountSchema>
export type ReviewTriggerType = z.infer<typeof reviewTriggerSchema>
export type InstructorReviewWorkloadSummary = z.infer<
  typeof instructorReviewWorkloadSummarySchema
>
