import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import { MaterialStatus } from '../interface/material-status'
import { MATERIAL_TITLE_MAX_LENGTH } from '../upload/materials.constants'
import type {
  MaterialStatusRecord,
  SafeMaterialRecord,
} from './materials.repository'

export interface UploadMaterialRequest {
  courseId?: string
  title?: string
}

export const listMaterialsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(15),
    cursor: z.uuid().optional(),
    search: z.string().trim().min(1).max(180).optional(),
  })
  .strict()

export type ListMaterialsQuery = z.infer<typeof listMaterialsQuerySchema>

export class MaterialUploadConfigurationDto {
  @Expose()
  @ApiProperty({ minimum: 1 })
  maxUploadBytes!: number

  @Expose()
  @ApiProperty({ example: 'application/pdf' })
  acceptedMimeType!: string

  @Expose()
  @ApiProperty({ example: '.pdf' })
  acceptedFileExtension!: string
}

export class UploadMaterialRequestDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Target course identifier. If provided, must match route parameter.',
  })
  courseId?: string

  @ApiProperty({ minLength: 1, maxLength: MATERIAL_TITLE_MAX_LENGTH })
  title!: string

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'A single PDF file.',
  })
  file!: string
}

export class MaterialDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ format: 'uuid' })
  courseId!: string

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

  @Expose()
  @ApiProperty()
  canDelete!: boolean
}

export class MaterialResponseDto {
  @Expose()
  @Type(() => MaterialDto)
  @ApiProperty({ type: MaterialDto })
  material!: MaterialDto
}

export class MaterialListResponseDto {
  @Expose()
  @Type(() => MaterialDto)
  @ApiProperty({ type: [MaterialDto] })
  materials!: MaterialDto[]

  @Expose()
  @ApiProperty({ minimum: 0 })
  total!: number

  @Expose()
  @ApiPropertyOptional({ format: 'uuid' })
  nextCursor?: string
}

export class MaterialStatusDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

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
  updatedAt!: string
}

export function mapMaterialRecord(
  material: SafeMaterialRecord,
  canDelete = false,
): MaterialDto {
  return {
    id: material.id,
    courseId: material.courseId,
    title: material.title,
    originalFilename: material.originalFilename,
    status: material.status,
    extractedTextLength: material.extractedTextLength,
    chunkCount: material.chunkCount,
    errorMessage: material.errorMessage,
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
    canDelete,
  }
}

export function mapMaterialStatusRecord(
  material: MaterialStatusRecord,
): MaterialStatusDto {
  return {
    id: material.id,
    status: material.status,
    extractedTextLength: material.extractedTextLength,
    chunkCount: material.chunkCount,
    errorMessage: material.errorMessage,
    updatedAt: material.updatedAt.toISOString(),
  }
}
