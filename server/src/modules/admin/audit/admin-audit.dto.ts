import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

export const adminAuditListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()

export type AdminAuditListQuery = z.infer<typeof adminAuditListQuerySchema>

export class AdminAuditActorDto {
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

export class AdminAuditEventDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  actorUserId!: string | null

  @Expose()
  @Type(() => AdminAuditActorDto)
  @ApiProperty({ type: AdminAuditActorDto, nullable: true })
  actor!: AdminAuditActorDto | null

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

export class AdminAuditEventListResponseDto {
  @Expose()
  @Type(() => AdminAuditEventDto)
  @ApiProperty({ type: [AdminAuditEventDto] })
  events!: AdminAuditEventDto[]
}
