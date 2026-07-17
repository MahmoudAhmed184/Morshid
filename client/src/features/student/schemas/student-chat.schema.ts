import { z } from 'zod'

const chatTitleSchema = z.string().trim().min(1).max(160)

export const studentAiTutorSearchSchema = z.object({
  courseId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
})

export const chatSessionSchema = z
  .object({
    id: z.uuid(),
    courseId: z.uuid(),
    title: chatTitleSchema,
    lastMessageAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()

export const chatSessionResponseSchema = z
  .object({
    session: chatSessionSchema,
  })
  .strict()

export const chatSessionListResponseSchema = z
  .object({
    sessions: z.array(chatSessionSchema),
    nextCursor: z.uuid().nullable(),
  })
  .strict()

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

export const chatMessageSchema = z
  .object({
    id: z.uuid(),
    sequence: z.number().int().positive(),
    role: chatMessageRoleSchema,
    responseToMessageId: z.uuid().nullable(),
    content: z.string(),
    status: chatMessageStatusSchema,
    requestKind: chatMessageRequestKindSchema.nullable(),
    guidanceLabel: chatMessageGuidanceLabelSchema.nullable(),
    hintLevel: z.number().int().nonnegative().nullable(),
    errorCode: z.string().nullable(),
    createdAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
  })
  .strict()

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
  })

export const createChatSessionRequestSchema = z
  .object({
    title: chatTitleSchema.optional(),
  })
  .strict()

export const renameChatSessionRequestSchema = z
  .object({
    title: chatTitleSchema,
  })
  .strict()

export const deleteChatSessionResponseSchema = z.undefined()

export const listChatSessionsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.uuid().optional(),
  })
  .strict()

export const listChatMessagesInputSchema = z
  .object({
    limit: z.number().int().min(1).max(200).optional(),
    after: z.number().int().nonnegative().optional(),
  })
  .strict()

export type ChatSession = z.infer<typeof chatSessionSchema>
export type ChatSessionListResponse = z.infer<
  typeof chatSessionListResponseSchema
>
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type ChatMessageHistoryResponse = z.infer<
  typeof chatMessageHistoryResponseSchema
>
export type CreateChatSessionInput = z.input<
  typeof createChatSessionRequestSchema
>
export type RenameChatSessionInput = z.input<
  typeof renameChatSessionRequestSchema
>
export type ListChatSessionsInput = z.input<typeof listChatSessionsInputSchema>
export type ListChatMessagesInput = z.input<typeof listChatMessagesInputSchema>
