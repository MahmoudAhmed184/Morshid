import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import { MaterialStatus } from '../interface/material-status'
import { MATERIAL_TITLE_MAX_LENGTH } from '../upload/materials.constants'

export const updateMaterialAdministrationRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(MATERIAL_TITLE_MAX_LENGTH),
  })
  .strict()

export type UpdateMaterialAdministrationRequest = z.infer<
  typeof updateMaterialAdministrationRequestSchema
>

export class UpdateMaterialAdministrationRequestDto {
  @ApiProperty({ minLength: 1, maxLength: MATERIAL_TITLE_MAX_LENGTH })
  title!: string
}

export class MaterialAdministrationUserDto {
  @Expose()
  @ApiProperty({ format: 'email' })
  email!: string

  @Expose()
  @ApiProperty()
  displayName!: string
}

export class MaterialAdministrationDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ format: 'uuid' })
  courseId!: string

  @Expose()
  @Type(() => MaterialAdministrationUserDto)
  @ApiProperty({ type: MaterialAdministrationUserDto })
  uploadedBy!: MaterialAdministrationUserDto

  @Expose()
  @ApiProperty()
  title!: string

  @Expose()
  @ApiProperty()
  originalFilename!: string

  @Expose()
  @ApiProperty({ enum: MaterialStatus, enumName: 'MaterialStatus' })
  status!: MaterialStatus

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string
}

export class MaterialAdministrationListResponseDto {
  @Expose()
  @Type(() => MaterialAdministrationDto)
  @ApiProperty({ type: [MaterialAdministrationDto] })
  materials!: MaterialAdministrationDto[]

  @Expose()
  @ApiProperty({ minimum: 0 })
  total!: number

  @Expose()
  @ApiProperty({ format: 'uuid', required: false })
  nextCursor?: string
}

export class MaterialAdministrationResponseDto {
  @Expose()
  @Type(() => MaterialAdministrationDto)
  @ApiProperty({ type: MaterialAdministrationDto })
  material!: MaterialAdministrationDto
}
