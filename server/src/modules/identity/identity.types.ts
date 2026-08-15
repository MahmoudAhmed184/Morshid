import { ApiProperty } from '@nestjs/swagger'
import { z } from 'zod'

import { UserRole, UserStatus } from './identity.roles'

export const IDENTITY_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  INVALID_ACCESS_TOKEN: 'INVALID_ACCESS_TOKEN',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INSUFFICIENT_ROLE: 'INSUFFICIENT_ROLE',
  CANNOT_REVOKE_CURRENT_SESSION: 'CANNOT_REVOKE_CURRENT_SESSION',
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

export interface IdentityUserRecord {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: UserStatus
  passwordHash: string
  passwordChangedAt: Date
  createdAt: Date
  updatedAt: Date
  disabledAt: Date | null
  disabledById: string | null
  lastLoginAt: Date | null
}

export interface RefreshTokenRecord {
  id: string
  userId: string
  familyId: string
  familyCreatedAt: Date
  tokenHash: string
  expiresAt: Date
  revokedAt: Date | null
  replacedByTokenId: string | null
  ip: string | null
  userAgent: string | null
  createdAt: Date
}

export interface RefreshTokenWithUserRecord extends RefreshTokenRecord {
  user: IdentityUserRecord
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

export class UpdateOwnProfileRequestDto {
  @ApiProperty({
    description: 'Updated display name for the authenticated user.',
    minLength: 2,
    maxLength: 120,
    example: 'Amina Al-Mansoor',
  })
  displayName!: string
}

export type UpdateOwnProfileRequest = UpdateOwnProfileRequestDto
export type AccountProfile = IdentityUserSummaryDto
export type AccountProfileResponse = MeResponseDto

export const updateOwnProfileRequestSchema = z
  .object({
    displayName: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim() : value),
      z.string().min(2).max(120),
    ),
  })
  .strict()

export class ActiveSessionDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Stable session family ID.',
    example: '00000000-0000-4000-8000-000000000001',
  })
  id!: string

  @ApiProperty({
    description: 'Parsed browser and operating system label.',
    example: 'Chrome on macOS',
  })
  device!: string

  @ApiProperty({
    description: 'Masked IP address.',
    nullable: true,
    example: '192.168.1.***',
  })
  ip!: string | null

  @ApiProperty({
    format: 'date-time',
    description: 'When the session family was initially created.',
  })
  createdAt!: string

  @ApiProperty({
    format: 'date-time',
    description: 'When the session was last active (last rotated or used).',
  })
  lastActiveAt!: string

  @ApiProperty({
    format: 'date-time',
    description: 'When the active session will expire.',
  })
  expiresAt!: string

  @ApiProperty({
    description: 'Whether this is the session making the current request.',
  })
  isCurrent!: boolean
}

export class ActiveSessionListResponseDto {
  @ApiProperty({ type: [ActiveSessionDto] })
  sessions!: ActiveSessionDto[]
}

export type ActiveSession = ActiveSessionDto
export type ActiveSessionListResponse = ActiveSessionListResponseDto
