import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

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

export type CreateUserImport = z.infer<typeof createUserImportSchema>

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
  @ApiProperty({ enum: ['VALID', 'INVALID', 'APPROVED'] })
  status!: string

  @Expose()
  @ApiProperty({ type: [String] })
  errors!: string[]
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
