import { z } from 'zod'

import {
  MIN_TUTORING_ALLOWANCE,
  MAX_TUTORING_ALLOWANCE,
  MIN_REVIEW_ALLOWANCE,
  MAX_REVIEW_ALLOWANCE,
} from './allowances.constants'

export const updateDeploymentDefaultsSchema = z
  .object({
    tutoringLimit: z
      .number()
      .int()
      .min(MIN_TUTORING_ALLOWANCE)
      .max(MAX_TUTORING_ALLOWANCE)
      .optional(),
    reviewLimit: z
      .number()
      .int()
      .min(MIN_REVIEW_ALLOWANCE)
      .max(MAX_REVIEW_ALLOWANCE)
      .optional(),
  })
  .refine(
    (data) =>
      data.tutoringLimit !== undefined || data.reviewLimit !== undefined,
    {
      message: 'At least one limit must be specified',
    },
  )

export type UpdateDeploymentDefaultsDto = z.infer<
  typeof updateDeploymentDefaultsSchema
>

export const setCoursePolicyOverrideSchema = z
  .object({
    tutoringLimit: z
      .number()
      .int()
      .min(MIN_TUTORING_ALLOWANCE)
      .max(MAX_TUTORING_ALLOWANCE)
      .nullable()
      .optional(),
    reviewLimit: z
      .number()
      .int()
      .min(MIN_REVIEW_ALLOWANCE)
      .max(MAX_REVIEW_ALLOWANCE)
      .nullable()
      .optional(),
  })
  .refine(
    (data) =>
      (data.tutoringLimit !== undefined && data.tutoringLimit !== null) ||
      (data.reviewLimit !== undefined && data.reviewLimit !== null),
    {
      message:
        'At least one allowance limit must be specified for a course override',
    },
  )

export type SetCoursePolicyOverrideDto = z.infer<
  typeof setCoursePolicyOverrideSchema
>

export const createAllowanceResetSchema = z.object({
  studentId: z.uuid(),
  courseId: z.uuid(),
  scope: z.enum(['TUTORING', 'REVIEW', 'BOTH']),
  reason: z.string().trim().min(1).max(500),
})

export type CreateAllowanceResetDto = z.infer<typeof createAllowanceResetSchema>

export const studentUsageQuerySchema = z.object({
  studentId: z.uuid(),
  courseId: z.uuid(),
})

export type StudentUsageQueryDto = z.infer<typeof studentUsageQuerySchema>
