import { z } from 'zod'

export const authRoleSchema = z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT'])
export const authStatusSchema = z.enum(['ACTIVE', 'DISABLED'])

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: authRoleSchema,
  status: authStatusSchema,
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

export type AuthRole = z.infer<typeof authRoleSchema>
export type AuthStatus = z.infer<typeof authStatusSchema>
export type AuthUser = z.infer<typeof authUserSchema>
export type AuthSession = z.infer<typeof authSessionSchema>
export type MeResponse = z.infer<typeof meResponseSchema>
