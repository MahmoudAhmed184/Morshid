import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import {
  CourseMembershipRole,
  MaterialStatus,
  UserRole,
  UserStatus,
} from '../../../generated/prisma/client'

// ---------------------------------------------------------------------------
// Zod request schemas
// ---------------------------------------------------------------------------

export const adminAddCourseMemberRequestSchema = z
  .object({
    userId: z.uuid(),
    role: z.enum(CourseMembershipRole),
  })
  .strict()

export const adminUpdateMaterialRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
  })
  .strict()

export const adminUpdateMemberRoleRequestSchema = z
  .object({
    role: z.enum(CourseMembershipRole),
  })
  .strict()

export type AdminAddCourseMemberRequest = z.infer<
  typeof adminAddCourseMemberRequestSchema
>
export type AdminUpdateMemberRoleRequest = z.infer<
  typeof adminUpdateMemberRoleRequestSchema
>
export type AdminUpdateMaterialRequest = z.infer<
  typeof adminUpdateMaterialRequestSchema
>

// ---------------------------------------------------------------------------
// Swagger request DTOs
// ---------------------------------------------------------------------------

export class AdminAddCourseMemberRequestDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string

  @ApiProperty({
    enum: CourseMembershipRole,
    enumName: 'CourseMembershipRole',
  })
  role!: CourseMembershipRole
}

export class AdminUpdateMemberRoleRequestDto {
  @ApiProperty({
    enum: CourseMembershipRole,
    enumName: 'CourseMembershipRole',
  })
  role!: CourseMembershipRole
}

export class AdminUpdateMaterialRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 180 })
  title!: string
}

// ---------------------------------------------------------------------------
// Shared embedded DTOs
// ---------------------------------------------------------------------------

export class AdminCourseUserSummaryDto {
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

export class AdminCourseMembershipDto {
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
  @Type(() => AdminCourseUserSummaryDto)
  @ApiProperty({ type: AdminCourseUserSummaryDto })
  user!: AdminCourseUserSummaryDto
}

export class AdminCourseMetadataDto {
  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  createdById!: string | null

  @Expose()
  @Type(() => AdminCourseUserSummaryDto)
  @ApiProperty({ type: AdminCourseUserSummaryDto, nullable: true })
  createdBy!: AdminCourseUserSummaryDto | null

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string

  @Expose()
  @Type(() => AdminCourseMembershipDto)
  @ApiProperty({ type: [AdminCourseMembershipDto] })
  memberships!: AdminCourseMembershipDto[]

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

export class AdminCourseItemDto {
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
  @Type(() => AdminCourseMetadataDto)
  @ApiProperty({ type: AdminCourseMetadataDto })
  adminMetadata!: AdminCourseMetadataDto
}

export class AdminCourseListResponseDto {
  @Expose()
  @Type(() => AdminCourseItemDto)
  @ApiProperty({ type: [AdminCourseItemDto] })
  courses!: AdminCourseItemDto[]
}

export class AdminCourseDetailResponseDto {
  @Expose()
  @Type(() => AdminCourseItemDto)
  @ApiProperty({ type: AdminCourseItemDto })
  course!: AdminCourseItemDto
}

// ---------------------------------------------------------------------------
// Membership response DTOs
// ---------------------------------------------------------------------------

export class AdminCourseMemberResponseDto {
  @Expose()
  @Type(() => AdminCourseMembershipDto)
  @ApiProperty({ type: AdminCourseMembershipDto })
  member!: AdminCourseMembershipDto
}

export class AdminCourseMemberListResponseDto {
  @Expose()
  @Type(() => AdminCourseMembershipDto)
  @ApiProperty({ type: [AdminCourseMembershipDto] })
  members!: AdminCourseMembershipDto[]
}

// ---------------------------------------------------------------------------
// Material response DTOs
// ---------------------------------------------------------------------------

export class AdminMaterialDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ format: 'uuid' })
  courseId!: string

  @Expose()
  @ApiProperty({ format: 'uuid' })
  uploadedById!: string

  @Expose()
  @Type(() => AdminCourseUserSummaryDto)
  @ApiProperty({ type: AdminCourseUserSummaryDto })
  uploadedBy!: AdminCourseUserSummaryDto

  @Expose()
  @ApiProperty()
  title!: string

  @Expose()
  @ApiProperty()
  originalFilename!: string

  @Expose()
  @ApiProperty()
  storagePath!: string

  @Expose()
  @ApiProperty({ nullable: true })
  sha256Hash!: string | null

  @Expose()
  @ApiProperty({ enum: MaterialStatus, enumName: 'MaterialStatus' })
  status!: MaterialStatus

  @Expose()
  @ApiProperty({ nullable: true })
  extractedTextLength!: number | null

  @Expose()
  @ApiProperty({ nullable: true })
  chunkCount!: number | null

  @Expose()
  @ApiProperty({ nullable: true })
  errorMessage!: string | null

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string
}

export class AdminMaterialListResponseDto {
  @Expose()
  @Type(() => AdminMaterialDto)
  @ApiProperty({ type: [AdminMaterialDto] })
  materials!: AdminMaterialDto[]
}

export class AdminMaterialResponseDto {
  @Expose()
  @Type(() => AdminMaterialDto)
  @ApiProperty({ type: AdminMaterialDto })
  material!: AdminMaterialDto
}
