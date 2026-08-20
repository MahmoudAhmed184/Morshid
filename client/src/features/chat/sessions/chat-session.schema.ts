import { z } from 'zod'

export const chatTitleSchema = z.string().trim().min(1).max(160)

export const chatSearchSchema = z.object({
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

export const chatSessionSummarySchema = z
  .object({
    turnsUsed: z.number().int().nonnegative(),
    turnLimit: z.number().int().positive(),
    turnsRemaining: z.number().int().nonnegative(),
    isTurnLimitExhausted: z.boolean(),
    contextTokens: z.number().int().nonnegative(),
    maxContextTokens: z.number().int().positive(),
    contextPercent: z.number().int().min(0).max(100),
    totalProcessedTokens: z.number().int().nonnegative().nullable(),
    policyDay: z.string(),
    policyTimeZone: z.string(),
    resetAt: z.string(),
  })
  .strict()

export const chatSessionSummaryResponseSchema = z
  .object({
    summary: chatSessionSummarySchema,
  })
  .strict()

export type ChatSession = z.infer<typeof chatSessionSchema>
export type ChatSessionListResponse = z.infer<
  typeof chatSessionListResponseSchema
>
export type ChatSessionSummary = z.infer<typeof chatSessionSummarySchema>
export type CreateChatSessionInput = z.input<
  typeof createChatSessionRequestSchema
>
export type RenameChatSessionInput = z.input<
  typeof renameChatSessionRequestSchema
>
export type ListChatSessionsInput = z.input<typeof listChatSessionsInputSchema>
