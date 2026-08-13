import { z } from 'zod'

import { studentReviewSummarySchema } from '@/features/reviews/interface/student-review.schema'
import { chatTitleSchema } from '@/features/chat/sessions/chat-session.schema'

export const chatMessageRoleSchema = z.enum(['STUDENT', 'ASSISTANT', 'SYSTEM'])

export const chatMessageStatusSchema = z.enum([
  'PENDING',
  'STREAMING',
  'COMPLETED',
  'FAILED',
  'BLOCKED',
])

export const chatMessageRequestKindSchema = z.enum([
  'CONCEPTUAL',
  'PROBLEM_LIKE',
  'ATTEMPT_DIAGNOSIS',
  'CODE_DIAGNOSIS',
  'UNSAFE',
  'OFF_TOPIC',
  'AMBIGUOUS',
])

export const chatMessageGuidanceLabelSchema = z.enum([
  'COURSE_GROUNDED',
  'GENERAL_NOT_FOUND',
  'UNCERTAIN_AWAITING_REVIEW',
  'INSTRUCTOR_REVIEWED',
  'REFUSAL',
])

export const chatCitationEvidenceSchema = z
  .object({
    rank: z.number().int().positive(),
    similarityScore: z.number().min(-1).max(1),
    chunkId: z.uuid(),
    chunkNumber: z.number().int().positive(),
    excerpt: z.string().refine((value) => Array.from(value).length <= 240, {
      message: 'Citation excerpts must contain at most 240 code points',
    }),
  })
  .strict()

export const chatCitationSchema = z
  .object({
    order: z.number().int().positive(),
    materialId: z.uuid(),
    materialTitle: z.string().trim().min(1),
    sourceAvailable: z.boolean(),
    sourceStatus: z.enum(['AVAILABLE', 'DELETED', 'UNAVAILABLE']),
    evidence: z.array(chatCitationEvidenceSchema),
  })
  .strict()
  .superRefine(({ sourceAvailable, sourceStatus, evidence }, context) => {
    if (sourceAvailable !== evidence.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'Citation availability must match its evidence',
        path: ['evidence'],
      })
    }

    if (sourceAvailable !== (sourceStatus === 'AVAILABLE')) {
      context.addIssue({
        code: 'custom',
        message: 'Citation status must match its availability',
        path: ['sourceStatus'],
      })
    }

    for (let index = 1; index < evidence.length; index += 1) {
      if (evidence[index].rank <= evidence[index - 1].rank) {
        context.addIssue({
          code: 'custom',
          message: 'Citation evidence must be ordered by increasing rank',
          path: ['evidence', index, 'rank'],
        })
      }
    }

    const chunkIds = new Set(evidence.map(({ chunkId }) => chunkId))
    if (chunkIds.size !== evidence.length) {
      context.addIssue({
        code: 'custom',
        message: 'Citation evidence must not repeat chunks',
        path: ['evidence'],
      })
    }
  })

export const chatMessageSchema = z
  .object({
    id: z.uuid(),
    sequence: z.number().int().positive(),
    role: chatMessageRoleSchema,
    attemptId: z.uuid().nullable(),
    topicId: z.uuid().nullable(),
    responseToMessageId: z.uuid().nullable(),
    content: z.string(),
    status: chatMessageStatusSchema,
    requestKind: chatMessageRequestKindSchema.nullable(),
    guidanceLabel: chatMessageGuidanceLabelSchema.nullable(),
    hintLevel: z.number().int().min(1).max(4).nullable(),
    promptVersion: z.string().trim().min(1).nullable(),
    errorCode: z.string().nullable(),
    createdAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    citations: z.array(chatCitationSchema),
    reviewSummary: studentReviewSummarySchema.nullable(),
  })
  .strict()
  .superRefine((message, context) => {
    if (message.role !== 'ASSISTANT' && message.citations.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'Only Assistant messages can include citations',
        path: ['citations'],
      })
    }

    if (message.role === 'STUDENT' && message.responseToMessageId !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Student messages cannot respond to another message',
        path: ['responseToMessageId'],
      })
    }

    for (let index = 1; index < message.citations.length; index += 1) {
      if (
        message.citations[index].order <= message.citations[index - 1].order
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Citations must be ordered by increasing order',
          path: ['citations', index, 'order'],
        })
      }
    }

    const materialIds = new Set(
      message.citations.map(({ materialId }) => materialId),
    )
    if (materialIds.size !== message.citations.length) {
      context.addIssue({
        code: 'custom',
        message: 'Citations must not repeat materials',
        path: ['citations'],
      })
    }
  })

export const chatTurnResponseSchema = z
  .object({
    studentMessage: chatMessageSchema,
    assistantMessage: chatMessageSchema,
  })
  .strict()
  .superRefine(({ studentMessage, assistantMessage }, context) => {
    if (studentMessage.role !== 'STUDENT') {
      context.addIssue({
        code: 'custom',
        message: 'A grounded turn must start with a Student message',
        path: ['studentMessage', 'role'],
      })
    }

    if (assistantMessage.role !== 'ASSISTANT') {
      context.addIssue({
        code: 'custom',
        message: 'A grounded turn must end with an Assistant message',
        path: ['assistantMessage', 'role'],
      })
    }

    if (assistantMessage.responseToMessageId !== studentMessage.id) {
      context.addIssue({
        code: 'custom',
        message: 'The Assistant response must reference its Student message',
        path: ['assistantMessage', 'responseToMessageId'],
      })
    }

    if (assistantMessage.sequence !== studentMessage.sequence + 1) {
      context.addIssue({
        code: 'custom',
        message: 'Grounded turn messages must have adjacent sequences',
        path: ['assistantMessage', 'sequence'],
      })
    }

    if (studentMessage.status !== 'COMPLETED') {
      context.addIssue({
        code: 'custom',
        message: 'A returned Student message must be persisted as completed',
        path: ['studentMessage', 'status'],
      })
    }

    if (
      assistantMessage.status !== 'COMPLETED' &&
      assistantMessage.status !== 'FAILED' &&
      assistantMessage.status !== 'BLOCKED'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A complete response must contain a terminal Assistant state',
        path: ['assistantMessage', 'status'],
      })
    }
  })

export const chatMessageHistoryResponseSchema = z
  .object({
    messages: z.array(chatMessageSchema),
    nextCursor: z.number().int().positive().nullable(),
  })
  .strict()
  .superRefine(({ messages }, context) => {
    for (let index = 1; index < messages.length; index += 1) {
      const previous = messages[index - 1]
      const current = messages[index]

      if (current.sequence <= previous.sequence) {
        context.addIssue({
          code: 'custom',
          message: 'Messages must be ordered by increasing sequence',
          path: ['messages', index, 'sequence'],
        })
      }
    }

    const messageIds = new Set(messages.map(({ id }) => id))
    if (messageIds.size !== messages.length) {
      context.addIssue({
        code: 'custom',
        message: 'Message history must not contain duplicate messages',
        path: ['messages'],
      })
    }
  })

export const chatMessageContentSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Array.from(value).length <= 4_000, {
    message: 'Message content must contain at most 4,000 code points',
  })

export const sendChatMessageRequestSchema = z
  .object({
    clientMessageId: z.uuid(),
    content: chatMessageContentSchema,
    problemId: z.uuid().optional(),
    conceptId: z.uuid().optional(),
    title: chatTitleSchema.optional(),
  })
  .strict()

export const listChatMessagesInputSchema = z
  .object({
    limit: z.number().int().min(1).max(200).optional(),
    after: z.number().int().nonnegative().optional(),
    before: z.number().int().positive().optional(),
    page: z.literal('latest').optional(),
  })
  .strict()
  .refine(
    ({ after, before, page }) =>
      [after, before, page].filter((value) => value !== undefined).length <= 1,
    {
      message:
        'Message pagination must use only one of after, before, or page=latest',
    },
  )

export type ChatMessage = z.infer<typeof chatMessageSchema>
export type ChatMessageHistoryResponse = z.infer<
  typeof chatMessageHistoryResponseSchema
>
export type ChatTurnResponse = z.infer<typeof chatTurnResponseSchema>
export type SendChatMessageInput = z.input<typeof sendChatMessageRequestSchema>
export type ListChatMessagesInput = z.input<typeof listChatMessagesInputSchema>
