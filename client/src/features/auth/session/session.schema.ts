import { z } from 'zod'

export const authRoleSchema = z.enum([
  'SUPER_ADMIN',
  'ADMIN',
  'INSTRUCTOR',
  'STUDENT',
])
export const authStatusSchema = z.enum(['ACTIVE', 'DISABLED'])

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: authRoleSchema,
  status: authStatusSchema,
  universityId: z.string().nullable().optional(),
})

export const authSessionSchema = z.object({
  tokenType: z.literal('Bearer'),
  user: authUserSchema,
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.iso.datetime(),
})

export const meResponseSchema = z.object({
  user: authUserSchema,
})

export const updateOwnProfileInputSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120),
  })
  .strict()

export const changePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(15, 'Password must be at least 15 characters')
      .max(128, 'Password must be at most 128 characters'),
    confirmation: z.string().min(1, 'Confirmation is required'),
  })
  .strict()
  .superRefine(({ newPassword, confirmation }, ctx) => {
    if (newPassword !== confirmation) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmation'],
        message: 'New password and confirmation do not match',
      })
    }
  })

export type AuthRole = z.infer<typeof authRoleSchema>
export type AuthStatus = z.infer<typeof authStatusSchema>
export type AuthUser = z.infer<typeof authUserSchema>
export type AuthSession = z.infer<typeof authSessionSchema>
export type MeResponse = z.infer<typeof meResponseSchema>
export type AccountProfile = AuthUser
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileInputSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>
