import { z } from 'zod'

export const policyDayWindowSchema = z.object({
  start: z.string(),
  end: z.string(),
  timeZone: z.string(),
})
export type PolicyDayWindow = z.infer<typeof policyDayWindowSchema>

export const studentAllowanceSchema = z.object({
  scope: z.enum(['TUTORING', 'REVIEW']),
  used: z.number(),
  limit: z.number(),
  remaining: z.number(),
  policyDayWindow: policyDayWindowSchema,
})
export type StudentAllowance = z.infer<typeof studentAllowanceSchema>

export const adminPolicyDefaultSchema = z.object({
  scope: z.enum(['TUTORING', 'REVIEW']),
  defaultLimit: z.number(),
  updatedAt: z.string(),
})
export type AdminPolicyDefault = z.infer<typeof adminPolicyDefaultSchema>

export const adminPolicyDefaultsResponseSchema = z.object({
  defaults: z.array(adminPolicyDefaultSchema),
})
export type AdminPolicyDefaultsResponse = z.infer<
  typeof adminPolicyDefaultsResponseSchema
>

export const adminCourseOverrideSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  scope: z.enum(['TUTORING', 'REVIEW']),
  overrideLimit: z.number(),
  updatedAt: z.string(),
})
export type AdminCourseOverride = z.infer<typeof adminCourseOverrideSchema>

export const adminCourseOverridesResponseSchema = z.object({
  overrides: z.array(adminCourseOverrideSchema),
})
export type AdminCourseOverridesResponse = z.infer<
  typeof adminCourseOverridesResponseSchema
>

export const adminAllowanceResetSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  courseId: z.string(),
  scope: z.enum(['TUTORING', 'REVIEW']),
  resetAt: z.string(),
  reason: z.string(),
})
export type AdminAllowanceReset = z.infer<typeof adminAllowanceResetSchema>

export const adminAllowanceResetResponseSchema = z.object({
  reset: adminAllowanceResetSchema,
})
export type AdminAllowanceResetResponse = z.infer<
  typeof adminAllowanceResetResponseSchema
>
