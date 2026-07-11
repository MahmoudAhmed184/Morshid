import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../../../generated/prisma/client'

export const adminCreateUserRequestSchema = z
  .object({
    email: z.preprocess(
      (value) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
      z.email(),
    ),
    displayName: z.string().trim().min(1).max(120),
    role: z.enum(UserRole),
    password: z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(50, 'Password must be at most 50 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one symbol'),
  })
  .strict()

export type AdminCreateUserRequest = z.infer<
  typeof adminCreateUserRequestSchema
>
export type AdminCreatableUserRole = Extract<
  UserRole,
  'STUDENT' | 'INSTRUCTOR'
>

export class AdminCreateUserRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string

  @ApiProperty({ maxLength: 120 })
  displayName!: string

  @ApiProperty({
    enum: [UserRole.STUDENT, UserRole.INSTRUCTOR],
    enumName: 'AdminCreateUserRole',
  })
  role!: AdminCreatableUserRole

  @ApiProperty({ minLength: 1 })
  password!: string
}

export class AdminUserDto {
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

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string
}

export class AdminCreateUserResponseDto {
  @Expose()
  @Type(() => AdminUserDto)
  @ApiProperty({ type: AdminUserDto })
  user!: AdminUserDto
}

export class AdminUserCourseAssignmentDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  courseId!: string

  @Expose()
  @ApiProperty()
  code!: string

  @Expose()
  @ApiProperty()
  title!: string

  @Expose()
  @ApiProperty({
    enum: CourseMembershipRole,
    enumName: 'CourseMembershipRole',
  })
  role!: CourseMembershipRole
}

export class AdminUserCourseAssignmentSummaryDto {
  @Expose()
  @ApiProperty({ minimum: 0 })
  courseCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  instructorCourseCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  studentCourseCount!: number

  @Expose()
  @Type(() => AdminUserCourseAssignmentDto)
  @ApiProperty({ type: [AdminUserCourseAssignmentDto] })
  courses!: AdminUserCourseAssignmentDto[]
}

export class AdminUserListItemDto {
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

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string

  @Expose()
  @Type(() => AdminUserCourseAssignmentSummaryDto)
  @ApiProperty({ type: () => AdminUserCourseAssignmentSummaryDto })
  courseAssignments!: AdminUserCourseAssignmentSummaryDto
}

export class AdminUserListResponseDto {
  @Expose()
  @Type(() => AdminUserListItemDto)
  @ApiProperty({ type: [AdminUserListItemDto] })
  users!: AdminUserListItemDto[]
}
