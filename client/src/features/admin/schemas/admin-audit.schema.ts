import { z } from 'zod'

const adminAuditActorSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
})

export const adminAuditEventSchema = z.object({
  id: z.uuid(),
  actorUserId: z.uuid().nullable(),
  actor: adminAuditActorSchema.nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.uuid().nullable(),
  courseId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
})

export const adminAuditEventListResponseSchema = z.object({
  events: z.array(adminAuditEventSchema),
})

export type AdminAuditEvent = z.infer<typeof adminAuditEventSchema>
