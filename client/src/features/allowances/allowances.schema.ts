import { z } from 'zod'

export const policyDayWindowSchema = z.object({
  start: z.string(),
  end: z.string(),
  timeZone: z.string(),
})
export type PolicyDayWindow = z.infer<typeof policyDayWindowSchema>

export const studentAllowanceSchema = z
  .object({
    limit: z.number(),
    used: z.number(),
    remaining: z.number(),
    resetAt: z.string().optional(),
    policyTimeZone: z.string().optional(),
    scope: z.enum(['TUTORING', 'REVIEW']).optional(),
    policyDayWindow: policyDayWindowSchema.optional(),
  })
  .transform((data) => {
    const policyTimeZone =
      data.policyTimeZone ?? data.policyDayWindow?.timeZone ?? 'Africa/Cairo'
    const resetAt =
      data.resetAt ??
      data.policyDayWindow?.end ??
      new Date(Date.now() + 86400000).toISOString()
    return {
      limit: data.limit,
      used: data.used,
      remaining: data.remaining,
      resetAt,
      policyTimeZone,
      scope: data.scope,
      policyDayWindow: data.policyDayWindow,
    }
  })
export type StudentAllowance = z.infer<typeof studentAllowanceSchema>

export const deploymentDefaultsSchema = z.object({
  id: z.string().optional().default('default'),
  tutoringLimit: z.number(),
  reviewLimit: z.number(),
  updatedAt: z.string(),
})
export type DeploymentDefaults = z.infer<typeof deploymentDefaultsSchema>

export const coursePolicyOverrideSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  courseCode: z.string().optional(),
  courseTitle: z.string().optional(),
  tutoringLimit: z.number().nullable().optional(),
  reviewLimit: z.number().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string(),
})
export type CoursePolicyOverride = z.infer<typeof coursePolicyOverrideSchema>

export const allowancePoliciesResponseSchema = z.object({
  deploymentDefaults: deploymentDefaultsSchema,
  courseOverrides: z.array(coursePolicyOverrideSchema),
  policyTimeZone: z.string(),
})
export type AllowancePoliciesResponse = z.infer<
  typeof allowancePoliciesResponseSchema
>

export const allowanceResetRecordSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  courseId: z.string(),
  scope: z.enum(['TUTORING', 'REVIEW', 'BOTH']),
  reason: z.string(),
  createdById: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  resetAt: z.string().optional(),
})
export type AllowanceResetRecord = z.infer<typeof allowanceResetRecordSchema>
