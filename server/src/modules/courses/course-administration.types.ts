import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'

// ---------------------------------------------------------------------------
// Zod request schemas
// ---------------------------------------------------------------------------

export const createCourseRequestSchema = z
  .object({
    code: z.string().trim().min(2).max(40),
    title: z.string().trim().min(3).max(160),
  })
  .strict()

export const updateCourseRequestSchema = z
  .object({
    code: z.string().trim().min(2).max(40).optional(),
    title: z.string().trim().min(3).max(160).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one course field must be provided',
  })

export const addCourseMemberRequestSchema = z
  .object({
    userId: z.uuid(),
    role: z.enum(CourseMembershipRole),
  })
  .strict()

export const updateMemberRoleRequestSchema = z
  .object({
    role: z.enum(CourseMembershipRole),
  })
  .strict()

export type CreateCourseRequest = z.infer<typeof createCourseRequestSchema>
export type UpdateCourseRequest = z.infer<typeof updateCourseRequestSchema>
export type AddCourseMemberRequest = z.infer<
  typeof addCourseMemberRequestSchema
>
export type UpdateMemberRoleRequest = z.infer<
  typeof updateMemberRoleRequestSchema
>
// ---------------------------------------------------------------------------
// Swagger request DTOs
// ---------------------------------------------------------------------------

export class CreateCourseRequestDto {
  @ApiProperty({ minLength: 2, maxLength: 40 })
  code!: string

  @ApiProperty({ minLength: 3, maxLength: 160 })
  title!: string
}

export class UpdateCourseRequestDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 40 })
  code?: string

  @ApiPropertyOptional({ minLength: 3, maxLength: 160 })
  title?: string
}

export class AddCourseMemberRequestDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string

  @ApiProperty({
    enum: CourseMembershipRole,
    enumName: 'CourseMembershipRole',
  })
  role!: CourseMembershipRole
}

export class UpdateMemberRoleRequestDto {
  @ApiProperty({
    enum: CourseMembershipRole,
    enumName: 'CourseMembershipRole',
  })
  role!: CourseMembershipRole
}

// ---------------------------------------------------------------------------
// Shared embedded DTOs
// ---------------------------------------------------------------------------

export class CourseAdministrationUserSummaryDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ format: 'email' })
  email!: string

  @Expose()
  @ApiProperty()
  displayName!: string

  @Expose()
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole

  @Expose()
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status!: UserStatus
}

export class CourseAdministrationMembershipDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ format: 'uuid' })
  userId!: string

  @Expose()
  @ApiProperty({
    enum: CourseMembershipRole,
    enumName: 'CourseMembershipRole',
  })
  role!: CourseMembershipRole

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @Type(() => CourseAdministrationUserSummaryDto)
  @ApiProperty({ type: CourseAdministrationUserSummaryDto })
  user!: CourseAdministrationUserSummaryDto
}

export class CourseAdministrationMetadataDto {
  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  createdById!: string | null

  @Expose()
  @Type(() => CourseAdministrationUserSummaryDto)
  @ApiProperty({ type: CourseAdministrationUserSummaryDto, nullable: true })
  createdBy!: CourseAdministrationUserSummaryDto | null

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string

  @Expose()
  @Type(() => CourseAdministrationMembershipDto)
  @ApiProperty({ type: [CourseAdministrationMembershipDto] })
  memberships!: CourseAdministrationMembershipDto[]

  @Expose()
  @ApiProperty({ minimum: 0 })
  memberCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  instructorCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  studentCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  materialCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  activeMaterialCount!: number
}

// ---------------------------------------------------------------------------
// Course response DTOs
// ---------------------------------------------------------------------------

export class CourseAdministrationItemDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty()
  code!: string

  @Expose()
  @ApiProperty()
  title!: string

  @Expose()
  @Type(() => CourseAdministrationMetadataDto)
  @ApiProperty({ type: CourseAdministrationMetadataDto })
  adminMetadata!: CourseAdministrationMetadataDto
}

export class CourseAdministrationListResponseDto {
  @Expose()
  @Type(() => CourseAdministrationItemDto)
  @ApiProperty({ type: [CourseAdministrationItemDto] })
  courses!: CourseAdministrationItemDto[]
}

export class CourseAdministrationDetailResponseDto {
  @Expose()
  @Type(() => CourseAdministrationItemDto)
  @ApiProperty({ type: CourseAdministrationItemDto })
  course!: CourseAdministrationItemDto
}

// ---------------------------------------------------------------------------
// Membership response DTOs
// ---------------------------------------------------------------------------

export class CourseAdministrationMemberResponseDto {
  @Expose()
  @Type(() => CourseAdministrationMembershipDto)
  @ApiProperty({ type: CourseAdministrationMembershipDto })
  member!: CourseAdministrationMembershipDto
}

export class CourseAdministrationMemberListResponseDto {
  @Expose()
  @Type(() => CourseAdministrationMembershipDto)
  @ApiProperty({ type: [CourseAdministrationMembershipDto] })
  members!: CourseAdministrationMembershipDto[]
}
