import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

export const auditListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(120).optional(),
    action: z.string().trim().min(1).max(100).optional(),
    targetType: z.string().trim().min(1).max(80).optional(),
    courseId: z.uuid().optional(),
    actorUserId: z.uuid().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .strict()

export type AuditListQuery = z.infer<typeof auditListQuerySchema>

export class ListAuditQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  page?: number

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  limit?: number

  @ApiPropertyOptional({ maxLength: 120 })
  search?: string

  @ApiPropertyOptional({ maxLength: 100 })
  action?: string

  @ApiPropertyOptional({ maxLength: 80 })
  targetType?: string

  @ApiPropertyOptional({ format: 'uuid' })
  courseId?: string

  @ApiPropertyOptional({ format: 'uuid' })
  actorUserId?: string

  @ApiPropertyOptional({ format: 'date-time' })
  startDate?: string

  @ApiPropertyOptional({ format: 'date-time' })
  endDate?: string
}

export class AuditActorDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ format: 'email' })
  email!: string

  @Expose()
  @ApiProperty()
  displayName!: string
}

export class AuditEventDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  actorUserId!: string | null

  @Expose()
  @Type(() => AuditActorDto)
  @ApiProperty({ type: AuditActorDto, nullable: true })
  actor!: AuditActorDto | null

  @Expose()
  @ApiProperty()
  action!: string

  @Expose()
  @ApiProperty()
  targetType!: string

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  targetId!: string | null

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  courseId!: string | null

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string
}

export class AuditEventListResponseDto {
  @Expose()
  @Type(() => AuditEventDto)
  @ApiProperty({ type: [AuditEventDto] })
  events!: AuditEventDto[]

  @Expose()
  @ApiProperty({ minimum: 0 })
  total!: number

  @Expose()
  @ApiProperty({ minimum: 1 })
  page!: number

  @Expose()
  @ApiProperty({ minimum: 1, maximum: 100 })
  limit!: number

  @Expose()
  @ApiProperty({ minimum: 1 })
  totalPages!: number
}
