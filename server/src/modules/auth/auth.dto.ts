import { z } from 'zod'

import type {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'

export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  INVALID_ACCESS_TOKEN: 'INVALID_ACCESS_TOKEN',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  INVALID_REQUEST: 'INVALID_REQUEST',
} as const

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES]

export interface AuthRequestContext {
  ip?: string | null
  userAgent?: string | null
}

export interface SignInRequest {
  email: string
  password: string
}

export interface RefreshRequest {
  refreshToken: string
}

export type LogoutRequest = RefreshRequest

export interface AuthCourseSummary {
  id: string
  code: string
  title: string
  membershipRole: CourseMembershipRole | null
}

export interface AuthUserSummary {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: UserStatus
  courses: AuthCourseSummary[]
}

export interface AuthSessionResponse {
  tokenType: 'Bearer'
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
  refreshTokenExpiresAt: string
  user: AuthUserSummary
}

export interface MeResponse {
  user: AuthUserSummary
}

export interface AuthenticatedRequestUser {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: UserStatus
}

export const signInRequestSchema = z
  .object({
    email: z.preprocess(
      (value) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
      z.email(),
    ),
    password: z.string().min(1),
  })
  .strict()

export const refreshRequestSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict()

export const logoutRequestSchema = refreshRequestSchema
