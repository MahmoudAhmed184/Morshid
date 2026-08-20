import { z } from 'zod'

const auditActorSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
})

export const auditEventSchema = z.object({
  id: z.uuid(),
  actorUserId: z.uuid().nullable(),
  actor: auditActorSchema.nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.uuid().nullable(),
  courseId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
})

export const auditEventListResponseSchema = z.object({
  events: z.array(auditEventSchema),
  total: z.number().int().nonnegative().default(0),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(20),
  totalPages: z.number().int().positive().default(1),
})

export type AuditEvent = z.infer<typeof auditEventSchema>
export type AuditActor = z.infer<typeof auditActorSchema>
export type AuditEventListResponse = z.infer<
  typeof auditEventListResponseSchema
>
