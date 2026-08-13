import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import { UserRole, UserStatus } from '../identity.roles'
import { CourseMembershipRole } from '../../courses/interface/course-membership-role'

const USER_PASSWORD_PATTERN =
  '^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,50}$'

export const userPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(50, 'Password must be at most 50 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one symbol')

export const createUserRequestSchema = z
  .object({
    email: z.preprocess(
      (value) =>
        typeof value === 'string' ? value.trim().toLowerCase() : value,
      z.email(),
    ),
    displayName: z.string().trim().min(1).max(120),
    role: z.enum([UserRole.STUDENT, UserRole.INSTRUCTOR]),
    password: userPasswordSchema,
  })
  .strict()

export const bulkCreateUsersRequestSchema = z
  .object({
    users: z.array(createUserRequestSchema).min(1).max(200),
  })
  .strict()
  .superRefine(({ users }, context) => {
    const seenEmails = new Set<string>()

    users.forEach((user, index) => {
      if (seenEmails.has(user.email)) {
        context.addIssue({
          code: 'custom',
          path: ['users', index, 'email'],
          message: 'Email appears more than once in this import',
        })
      }

      seenEmails.add(user.email)
    })
  })

export const updateUserRequestSchema = z
  .object({
    email: z
      .preprocess(
        (value) =>
          typeof value === 'string' ? value.trim().toLowerCase() : value,
        z.email(),
      )
      .optional(),
    displayName: z.string().trim().min(1).max(120).optional(),
    role: z.enum([UserRole.STUDENT, UserRole.INSTRUCTOR]).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one user field must be provided',
  })

export const resetUserPasswordRequestSchema = z
  .object({
    newPassword: userPasswordSchema,
  })
  .strict()

export const listUsersQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.uuid().optional(),
    role: z.enum([UserRole.STUDENT, UserRole.INSTRUCTOR]).optional(),
    status: z.enum([UserStatus.ACTIVE, UserStatus.DISABLED]).optional(),
    courseId: z.uuid().optional(),
    search: z.string().trim().min(1).max(120).optional(),
  })
  .strict()

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>
export type BulkCreateUsersRequest = z.infer<
  typeof bulkCreateUsersRequestSchema
>
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>
export type ResetUserPasswordRequest = z.infer<
  typeof resetUserPasswordRequestSchema
>
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
export type CreatableUserRole = Extract<UserRole, 'STUDENT' | 'INSTRUCTOR'>

export class CreateUserRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string

  @ApiProperty({ maxLength: 120 })
  displayName!: string

  @ApiProperty({
    enum: [UserRole.STUDENT, UserRole.INSTRUCTOR],
    enumName: 'CreatableUserRole',
  })
  role!: CreatableUserRole

  @ApiProperty({
    minLength: 8,
    maxLength: 50,
    pattern: USER_PASSWORD_PATTERN,
  })
  password!: string
}

export class BulkCreateUsersRequestDto {
  @ApiProperty({ type: [CreateUserRequestDto], minItems: 1, maxItems: 200 })
  users!: CreateUserRequestDto[]
}

export class UpdateUserRequestDto {
  @ApiPropertyOptional({ format: 'email' })
  email?: string

  @ApiPropertyOptional({ maxLength: 120 })
  displayName?: string

  @ApiPropertyOptional({
    enum: [UserRole.STUDENT, UserRole.INSTRUCTOR],
    enumName: 'CreatableUserRole',
  })
  role?: CreatableUserRole
}

export class ResetUserPasswordRequestDto {
  @ApiProperty({
    minLength: 8,
    maxLength: 50,
    pattern: USER_PASSWORD_PATTERN,
  })
  newPassword!: string
}

export class ListUsersQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  limit?: number

  @ApiPropertyOptional({ format: 'uuid' })
  cursor?: string

  @ApiPropertyOptional({
    enum: [UserRole.STUDENT, UserRole.INSTRUCTOR],
    enumName: 'CreatableUserRole',
  })
  role?: CreatableUserRole

  @ApiPropertyOptional({ enum: UserStatus, enumName: 'UserStatus' })
  status?: UserStatus

  @ApiPropertyOptional({ format: 'uuid' })
  courseId?: string

  @ApiPropertyOptional({ maxLength: 120 })
  search?: string
}

export class ManagedUserDto {
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

export class CreateUserResponseDto {
  @Expose()
  @Type(() => ManagedUserDto)
  @ApiProperty({ type: ManagedUserDto })
  user!: ManagedUserDto
}

export class BulkCreateUsersResponseDto {
  @Expose()
  @Type(() => ManagedUserDto)
  @ApiProperty({ type: [ManagedUserDto] })
  users!: ManagedUserDto[]
}

export class UpdateUserResponseDto {
  @Expose()
  @Type(() => ManagedUserDto)
  @ApiProperty({ type: ManagedUserDto })
  user!: ManagedUserDto
}

export class DisableUserResponseDto {
  @Expose()
  @Type(() => ManagedUserDto)
  @ApiProperty({ type: ManagedUserDto })
  user!: ManagedUserDto
}

export class ReactivateUserResponseDto {
  @Expose()
  @Type(() => ManagedUserDto)
  @ApiProperty({ type: ManagedUserDto })
  user!: ManagedUserDto
}

export class ResetUserPasswordResponseDto {
  @Expose()
  @Type(() => ManagedUserDto)
  @ApiProperty({ type: ManagedUserDto })
  user!: ManagedUserDto
}

export class ManagedUserCourseAssignmentDto {
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

export class ManagedUserCourseAssignmentSummaryDto {
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
  @Type(() => ManagedUserCourseAssignmentDto)
  @ApiProperty({ type: [ManagedUserCourseAssignmentDto] })
  courses!: ManagedUserCourseAssignmentDto[]
}

export class ManagedUserListItemDto {
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
  @Type(() => ManagedUserCourseAssignmentSummaryDto)
  @ApiProperty({ type: () => ManagedUserCourseAssignmentSummaryDto })
  courseAssignments!: ManagedUserCourseAssignmentSummaryDto
}

export class ManagedUserListResponseDto {
  @Expose()
  @Type(() => ManagedUserListItemDto)
  @ApiProperty({ type: [ManagedUserListItemDto] })
  users!: ManagedUserListItemDto[]

  @Expose()
  @ApiPropertyOptional({ format: 'uuid' })
  nextCursor?: string
}
