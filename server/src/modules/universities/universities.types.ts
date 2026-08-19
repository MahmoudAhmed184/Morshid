import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import { UniversityStatus, UserStatus } from '../identity/identity.roles'
import { passwordSchema } from '../identity/identity.public'

// Allowed sort fields
export const UNIVERSITY_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'code',
  'status',
  'studentsCount',
] as const

export type UniversitySortField = (typeof UNIVERSITY_SORT_FIELDS)[number]

export const SORT_ORDERS = ['asc', 'desc'] as const
export type SortOrder = (typeof SORT_ORDERS)[number]

// Normalization functions
export function normalizeUniversityCode(code: string): string {
  return code.trim().toUpperCase()
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// Code regex: alphanumeric, underscores, and hyphens (2-50 chars)
export const universityCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'University code may only contain alphanumeric characters, underscores, and hyphens',
  )
  .transform(normalizeUniversityCode)

// Request Schemas
export const createUniversityOwnerSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    email: z.preprocess(
      (value) => (typeof value === 'string' ? normalizeEmail(value) : value),
      z.email(),
    ),
    password: passwordSchema,
  })
  .strict()

export const createUniversityRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    code: universityCodeSchema,
    status: z
      .enum([
        UniversityStatus.ACTIVE,
        UniversityStatus.INACTIVE,
        UniversityStatus.SUSPENDED,
      ])
      .default(UniversityStatus.ACTIVE),
    owner: createUniversityOwnerSchema,
  })
  .strict()

export const updateUniversityOwnerSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    email: z
      .preprocess(
        (value) => (typeof value === 'string' ? normalizeEmail(value) : value),
        z.email(),
      )
      .optional(),
    password: passwordSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one owner field must be provided',
  })

export const updateUniversityRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    code: universityCodeSchema.optional(),
    owner: updateUniversityOwnerSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one university field must be provided',
  })

export const updateUniversityStatusRequestSchema = z
  .object({
    status: z.enum([
      UniversityStatus.ACTIVE,
      UniversityStatus.INACTIVE,
      UniversityStatus.SUSPENDED,
    ]),
  })
  .strict()

export const listUniversitiesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(120).optional(),
    status: z
      .enum([
        UniversityStatus.ACTIVE,
        UniversityStatus.INACTIVE,
        UniversityStatus.SUSPENDED,
      ])
      .optional(),
    sortBy: z.enum(UNIVERSITY_SORT_FIELDS).default('createdAt'),
    sortOrder: z.enum(SORT_ORDERS).default('desc'),
  })
  .strict()

export type CreateUniversityOwnerInput = z.infer<
  typeof createUniversityOwnerSchema
>
export type CreateUniversityRequest = z.infer<
  typeof createUniversityRequestSchema
>
export type UpdateUniversityRequest = z.infer<
  typeof updateUniversityRequestSchema
>
export type UpdateUniversityOwnerInput = z.infer<
  typeof updateUniversityOwnerSchema
>
export type UpdateUniversityStatusRequest = z.infer<
  typeof updateUniversityStatusRequestSchema
>
export type ListUniversitiesQuery = z.infer<typeof listUniversitiesQuerySchema>

// Swagger request DTOs
export class CreateUniversityOwnerRequestDto {
  @ApiProperty({ maxLength: 120 })
  displayName!: string

  @ApiProperty({ format: 'email' })
  email!: string

  @ApiProperty({ minLength: 15, maxLength: 128 })
  password!: string
}

export class CreateUniversityRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 160 })
  name!: string

  @ApiProperty({ minLength: 2, maxLength: 50 })
  code!: string

  @ApiPropertyOptional({
    enum: UniversityStatus,
    enumName: 'UniversityStatus',
    default: UniversityStatus.ACTIVE,
  })
  status?: UniversityStatus

  @ApiProperty({ type: CreateUniversityOwnerRequestDto })
  owner!: CreateUniversityOwnerRequestDto
}

export class UpdateUniversityOwnerRequestDto {
  @ApiPropertyOptional({ maxLength: 120 })
  displayName?: string

  @ApiPropertyOptional({ format: 'email' })
  email?: string

  @ApiPropertyOptional({ minLength: 15, maxLength: 128 })
  password?: string
}

export class UpdateUniversityRequestDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 160 })
  name?: string

  @ApiPropertyOptional({ minLength: 2, maxLength: 50 })
  code?: string

  @ApiPropertyOptional({ type: UpdateUniversityOwnerRequestDto })
  owner?: UpdateUniversityOwnerRequestDto
}

export class UpdateUniversityStatusRequestDto {
  @ApiProperty({ enum: UniversityStatus, enumName: 'UniversityStatus' })
  status!: UniversityStatus
}

export class ListUniversitiesQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  page?: number

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  limit?: number

  @ApiPropertyOptional({ maxLength: 120 })
  search?: string

  @ApiPropertyOptional({ enum: UniversityStatus, enumName: 'UniversityStatus' })
  status?: UniversityStatus

  @ApiPropertyOptional({
    enum: UNIVERSITY_SORT_FIELDS,
    enumName: 'UniversitySortField',
    default: 'createdAt',
  })
  sortBy?: UniversitySortField

  @ApiPropertyOptional({
    enum: SORT_ORDERS,
    enumName: 'SortOrder',
    default: 'desc',
  })
  sortOrder?: SortOrder
}

// Swagger / Response DTOs
export class UniversityOwnerSummaryDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty()
  displayName!: string

  @Expose()
  @ApiProperty({ format: 'email' })
  email!: string

  @Expose()
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status!: UserStatus
}

export class UniversityItemDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty()
  name!: string

  @Expose()
  @ApiProperty()
  code!: string

  @Expose()
  @ApiProperty({ enum: UniversityStatus, enumName: 'UniversityStatus' })
  status!: UniversityStatus

  @Expose()
  @Type(() => UniversityOwnerSummaryDto)
  @ApiPropertyOptional({ type: UniversityOwnerSummaryDto, nullable: true })
  owner!: UniversityOwnerSummaryDto | null
  @Expose()
  @ApiProperty({ minimum: 0 })
  studentsCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  instructorsCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  coursesCount!: number

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string
}

export class PaginationMetadataDto {
  @Expose()
  @ApiProperty({ minimum: 1 })
  page!: number

  @Expose()
  @ApiProperty({ minimum: 1, maximum: 100 })
  limit!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  totalCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  totalPages!: number
}

export class UniversityListResponseDto {
  @Expose()
  @Type(() => UniversityItemDto)
  @ApiProperty({ type: [UniversityItemDto] })
  data!: UniversityItemDto[]

  @Expose()
  @Type(() => PaginationMetadataDto)
  @ApiProperty({ type: PaginationMetadataDto })
  pagination!: PaginationMetadataDto
}

export class UniversityResponseDto {
  @Expose()
  @Type(() => UniversityItemDto)
  @ApiProperty({ type: UniversityItemDto })
  university!: UniversityItemDto
}
