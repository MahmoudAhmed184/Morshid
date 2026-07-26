import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { z } from 'zod'

import {
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
  INSUFFICIENT_ROLE: 'INSUFFICIENT_ROLE',
} as const

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES]

export interface AuthRequestContext {
  ip?: string | null
  userAgent?: string | null
}

export interface AuthenticatedRequestUser {
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

export class RefreshRequestDto {
  @ApiPropertyOptional({
    minLength: 1,
    description:
      'JSON fallback for non-browser clients. Omit when the morshid_refresh cookie is present.',
  })
  refreshToken?: string
}

export class AuthCourseSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string

  @ApiProperty()
  code!: string

  @ApiProperty()
  title!: string

  @ApiProperty({
    enum: CourseMembershipRole,
    enumName: 'CourseMembershipRole',
    nullable: true,
  })
  membershipRole!: CourseMembershipRole | null
}

export class AuthUserSummaryDto {
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

  @ApiProperty({ type: [AuthCourseSummaryDto] })
  courses!: AuthCourseSummaryDto[]
}

export class AuthSessionResponseDto {
  @ApiProperty({ enum: ['Bearer'] })
  tokenType!: 'Bearer'

  @ApiProperty({ description: 'JWT access token.' })
  accessToken!: string

  @ApiProperty({ format: 'date-time' })
  accessTokenExpiresAt!: string

  @ApiProperty({ description: 'Opaque refresh token for JSON-based clients.' })
  refreshToken!: string

  @ApiProperty({ format: 'date-time' })
  refreshTokenExpiresAt!: string

  @ApiProperty({ type: AuthUserSummaryDto })
  user!: AuthUserSummaryDto
}

export class MeResponseDto {
  @ApiProperty({ type: AuthUserSummaryDto })
  user!: AuthUserSummaryDto
}

export type SignInRequest = SignInRequestDto
export type RefreshHttpRequest = RefreshRequestDto
export type RefreshRequest = Required<RefreshRequestDto>
export type LogoutRequest = RefreshRequest
export type AuthCourseSummary = AuthCourseSummaryDto
export type AuthUserSummary = AuthUserSummaryDto
export type AuthSessionResponse = AuthSessionResponseDto
export type MeResponse = MeResponseDto

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
    refreshToken: z.string().min(1).optional(),
  })
  .strict()

export const logoutRequestSchema = refreshRequestSchema
