import { z } from 'zod'

export const aiReadinessStatusSchema = z.enum([
  'Ready',
  'Pressured',
  'Blocked',
  'Unknown',
])
export type AiReadinessStatus = z.infer<typeof aiReadinessStatusSchema>

export const aiCapacityProjectCooldownSchema = z.object({
  projectIndex: z.number(),
  cooldownRemainingMs: z.number(),
  cooldownUntil: z.string().nullable(),
})
export type AiCapacityProjectCooldown = z.infer<
  typeof aiCapacityProjectCooldownSchema
>

export const aiCapacityChatPoolSchema = z.object({
  status: aiReadinessStatusSchema,
  totalProjects: z.number(),
  availableProjects: z.number(),
  cooledDownProjects: z.number(),
  cooldownDetails: z.array(aiCapacityProjectCooldownSchema),
})
export type AiCapacityChatPool = z.infer<typeof aiCapacityChatPoolSchema>

export const aiCapacityQuotaDimensionSchema = z.object({
  name: z.string(),
  mode: z.string(),
  capacity: z.number(),
  availableOrUsed: z.number(),
  windowMs: z.number(),
  status: z.enum(['Ready', 'Pressured', 'Blocked']),
})
export type AiCapacityQuotaDimension = z.infer<
  typeof aiCapacityQuotaDimensionSchema
>

export const aiCapacityEmbeddingSchema = z.object({
  status: aiReadinessStatusSchema,
  provider: z.string(),
  model: z.string(),
  dimensions: z.number(),
  quotaDimensions: z.array(aiCapacityQuotaDimensionSchema).optional(),
})
export type AiCapacityEmbedding = z.infer<typeof aiCapacityEmbeddingSchema>

export const aiCapacityResponseSchema = z.object({
  overallStatus: aiReadinessStatusSchema,
  disclaimer: z.string(),
  chatPool: aiCapacityChatPoolSchema,
  embedding: aiCapacityEmbeddingSchema,
  observedAt: z.string(),
})
export type AiCapacityResponse = z.infer<typeof aiCapacityResponseSchema>
