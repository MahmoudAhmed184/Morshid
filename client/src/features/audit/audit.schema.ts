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
})

export type AuditEvent = z.infer<typeof auditEventSchema>
