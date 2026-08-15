import { z } from 'zod'

export const activeSessionSchema = z.object({
  id: z.string().uuid(),
  device: z.string(),
  ip: z.string().nullable(),
  createdAt: z.string(),
  lastActiveAt: z.string(),
  expiresAt: z.string(),
  isCurrent: z.boolean(),
})

export const activeSessionListResponseSchema = z.object({
  sessions: z.array(activeSessionSchema),
})

export type ActiveSession = z.infer<typeof activeSessionSchema>
export type ActiveSessionListResponse = z.infer<
  typeof activeSessionListResponseSchema
>
