import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'

import { MaterialStatus, type Material } from '../../generated/prisma/client'

export interface UploadMaterialRequest {
  title?: string
}

export type SafeMaterialRecord = Pick<
  Material,
  | 'id'
  | 'courseId'
  | 'title'
  | 'originalFilename'
  | 'status'
  | 'extractedTextLength'
  | 'chunkCount'
  | 'errorMessage'
  | 'createdAt'
  | 'updatedAt'
>

export class UploadMaterialRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 180 })
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
}

export class MaterialResponseDto {
  @Expose()
  @Type(() => MaterialDto)
  @ApiProperty({ type: MaterialDto })
  material!: MaterialDto
}

export function mapMaterialRecord(material: SafeMaterialRecord): MaterialDto {
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
  }
}
