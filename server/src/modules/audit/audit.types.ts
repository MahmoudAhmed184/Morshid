import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

export const auditListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()

export type AuditListQuery = z.infer<typeof auditListQuerySchema>

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
}
