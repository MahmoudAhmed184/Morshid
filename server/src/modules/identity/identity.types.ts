import { ApiProperty } from '@nestjs/swagger'
import { z } from 'zod'

import { UserRole, UserStatus } from '../../generated/prisma/client'

export const IDENTITY_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  INVALID_ACCESS_TOKEN: 'INVALID_ACCESS_TOKEN',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INSUFFICIENT_ROLE: 'INSUFFICIENT_ROLE',
} as const

export type IdentityErrorCode =
  (typeof IDENTITY_ERROR_CODES)[keyof typeof IDENTITY_ERROR_CODES]

export interface IdentityRequestContext {
  ip?: string | null
  userAgent?: string | null
}

export interface AuthenticatedUser {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: UserStatus
}

export class SignInRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string

  @ApiProperty({ minLength: 1, format: 'password' })
  password!: string
}

export class IdentityUserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string

  @ApiProperty({ format: 'email' })
  email!: string

  @ApiProperty()
  displayName!: string

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole

  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status!: UserStatus
}

export class IdentitySessionResponseDto {
  @ApiProperty({ enum: ['Bearer'] })
  tokenType!: 'Bearer'

  @ApiProperty({ description: 'JWT access token.' })
  accessToken!: string

  @ApiProperty({ format: 'date-time' })
  accessTokenExpiresAt!: string

  @ApiProperty({ type: IdentityUserSummaryDto })
  user!: IdentityUserSummaryDto
}

export class MeResponseDto {
  @ApiProperty({ type: IdentityUserSummaryDto })
  user!: IdentityUserSummaryDto
}

export type SignInRequest = SignInRequestDto
export interface RefreshRequest {
  refreshToken: string
}

export type LogoutRequest = RefreshRequest
export type IdentityUserSummary = IdentityUserSummaryDto
export type IdentitySessionResponse = IdentitySessionResponseDto
export type MeResponse = MeResponseDto

export interface IdentitySession {
  response: IdentitySessionResponse
  refreshToken: string
  refreshTokenExpiresAt: string
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
