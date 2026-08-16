import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import { userPasswordSchema } from './user-administration.types'

export const createUserImportSchema = z
  .object({
    rows: z
      .array(
        z
          .object({
            rowNumber: z.number().int().min(2),
            displayName: z.string().optional().default(''),
            email: z.string().optional().default(''),
            password: z.string().optional().default(''),
            role: z.string().optional().default(''),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict()

export const userImportIdSchema = z.uuid()
export const updateUserImportRowSchema = z
  .object({
    displayName: z.string().optional(),
    email: z.string().optional(),
    password: z.preprocess(
      (value) => (value === '' ? undefined : value),
      userPasswordSchema.optional(),
    ),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one row field must be provided',
  })

export type CreateUserImport = z.infer<typeof createUserImportSchema>
export type UpdateUserImportRow = z.infer<typeof updateUserImportRowSchema>

export class UpdateUserImportRowDto {
  @ApiProperty({ required: false, maxLength: 120 })
  displayName?: string

  @ApiProperty({ required: false, format: 'email' })
  email?: string

  @ApiProperty({
    required: false,
    format: 'password',
    minLength: 15,
    maxLength: 128,
  })
  password?: string
}

export class CreateUserImportRowDto {
  @ApiProperty({ minimum: 2 })
  rowNumber!: number

  @ApiProperty()
  displayName!: string

  @ApiProperty()
  email!: string

  @ApiProperty({ format: 'password' })
  password!: string

  @ApiProperty()
  role!: string
}

export class CreateUserImportDto {
  @ApiProperty({ type: [CreateUserImportRowDto], minItems: 1, maxItems: 200 })
  rows!: CreateUserImportRowDto[]
}

export class UserImportRowDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty()
  rowNumber!: number

  @Expose()
  @ApiProperty({ nullable: true })
  displayName!: string | null

  @Expose()
  @ApiProperty({ nullable: true })
  email!: string | null

  @Expose()
  @ApiProperty({ nullable: true })
  role!: string | null

  @Expose()
  @ApiProperty({ enum: ['VALID', 'INVALID', 'APPROVED', 'CANCELLED'] })
  status!: string

  @Expose()
  @ApiProperty({ type: [String] })
  errors!: string[]

  @Expose()
  @ApiProperty()
  hasPassword!: boolean
}

export class UserImportDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ enum: ['PENDING', 'APPROVED'] })
  status!: string

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ format: 'date-time', nullable: true })
  approvedAt!: string | null

  @Expose()
  @Type(() => UserImportRowDto)
  @ApiProperty({ type: [UserImportRowDto] })
  rows!: UserImportRowDto[]
}

export class UserImportResponseDto {
  @Expose()
  @Type(() => UserImportDto)
  @ApiProperty({ type: UserImportDto })
  userImport!: UserImportDto
}
