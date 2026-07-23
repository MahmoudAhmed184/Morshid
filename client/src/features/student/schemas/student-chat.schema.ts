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
    evidence: z.array(chatCitationEvidenceSchema),
  })
  .strict()
  .superRefine(({ sourceAvailable, evidence }, context) => {
    if (sourceAvailable !== evidence.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'Citation availability must match its evidence',
        path: ['evidence'],
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
    responseToMessageId: z.uuid().nullable(),
    content: z.string(),
    status: chatMessageStatusSchema,
    requestKind: chatMessageRequestKindSchema.nullable(),
    guidanceLabel: chatMessageGuidanceLabelSchema.nullable(),
    hintLevel: z.number().int().nonnegative().nullable(),
    errorCode: z.string().nullable(),
    createdAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    citations: z.array(chatCitationSchema),
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

export const groundedChatTurnResponseSchema = z
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

export const sendStudentChatMessageRequestSchema = z
  .object({
    clientMessageId: z.uuid(),
    content: z
      .string()
      .trim()
      .min(1)
      .refine((value) => Array.from(value).length <= 4_000, {
        message: 'Message content must contain at most 4,000 code points',
      }),
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

export type ChatSession = z.infer<typeof chatSessionSchema>
export type ChatSessionListResponse = z.infer<
  typeof chatSessionListResponseSchema
>
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type ChatMessageHistoryResponse = z.infer<
  typeof chatMessageHistoryResponseSchema
>
export type GroundedChatTurnResponse = z.infer<
  typeof groundedChatTurnResponseSchema
>
export type CreateChatSessionInput = z.input<
  typeof createChatSessionRequestSchema
>
export type RenameChatSessionInput = z.input<
  typeof renameChatSessionRequestSchema
>
export type SendStudentChatMessageInput = z.input<
  typeof sendStudentChatMessageRequestSchema
>
export type ListChatSessionsInput = z.input<typeof listChatSessionsInputSchema>
export type ListChatMessagesInput = z.input<typeof listChatMessagesInputSchema>
