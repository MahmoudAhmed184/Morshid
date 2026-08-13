import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import { CourseMembershipRole } from './course-membership.types'
import { UserRole, UserStatus } from '../identity/identity.roles'

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

export const bulkAddCourseMembersRequestSchema = z
  .object({
    courseIds: z.array(z.uuid()).min(1).max(50),
    userIds: z.array(z.uuid()).min(1).max(200),
    role: z.enum(CourseMembershipRole),
  })
  .strict()
  .refine(
    ({ courseIds, userIds }) => courseIds.length * userIds.length <= 1_000,
    { message: 'A bulk assignment may contain at most 1,000 assignments' },
  )

export const updateMemberRoleRequestSchema = z
  .object({
    role: z.enum(CourseMembershipRole),
  })
  .strict()

export const listCourseAdministrationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.uuid().optional(),
    search: z.string().trim().min(1).max(120).optional(),
  })
  .strict()

export const listCourseMembersQuerySchema = listCourseAdministrationQuerySchema
  .extend({ role: z.enum(CourseMembershipRole).optional() })
  .strict()

export type CreateCourseRequest = z.infer<typeof createCourseRequestSchema>
export type UpdateCourseRequest = z.infer<typeof updateCourseRequestSchema>
export type AddCourseMemberRequest = z.infer<
  typeof addCourseMemberRequestSchema
>
export type BulkAddCourseMembersRequest = z.infer<
  typeof bulkAddCourseMembersRequestSchema
>
export type UpdateMemberRoleRequest = z.infer<
  typeof updateMemberRoleRequestSchema
>
export type ListCourseAdministrationQuery = z.infer<
  typeof listCourseAdministrationQuerySchema
>
export type ListCourseMembersQuery = z.infer<
  typeof listCourseMembersQuerySchema
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

export class BulkAddCourseMembersRequestDto {
  @ApiProperty({ type: [String], format: 'uuid', maxItems: 50 })
  courseIds!: string[]

  @ApiProperty({ type: [String], format: 'uuid', maxItems: 200 })
  userIds!: string[]

  @ApiProperty({ enum: CourseMembershipRole, enumName: 'CourseMembershipRole' })
  role!: CourseMembershipRole
}

export class BulkAddCourseMembersResponseDto {
  @Expose()
  @ApiProperty({ minimum: 0 })
  assignedCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  skippedCount!: number
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

  @Expose()
  @ApiPropertyOptional({ format: 'uuid' })
  nextCursor?: string
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

  @Expose()
  @ApiPropertyOptional({ format: 'uuid' })
  nextCursor?: string
}
