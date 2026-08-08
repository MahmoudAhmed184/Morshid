import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import {
  NotificationStatus,
  NotificationType,
} from '../../generated/prisma/client'

export const notificationListQuerySchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>

export class NotificationListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  cursor?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  limit?: number
}

export class StudentNotificationDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  reviewCaseId!: string | null

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  messageId!: string | null

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  sessionId!: string | null

  @Expose()
  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type!: NotificationType

  @Expose()
  @ApiProperty({ enum: NotificationStatus, enumName: 'NotificationStatus' })
  status!: NotificationStatus

  @Expose()
  @ApiProperty()
  title!: string

  @Expose()
  @ApiProperty()
  body!: string

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ format: 'date-time', nullable: true })
  readAt!: string | null
}

export class NotificationListResponseDto {
  @Expose()
  @Type(() => StudentNotificationDto)
  @ApiProperty({ type: [StudentNotificationDto] })
  items!: StudentNotificationDto[]

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  nextCursor!: string | null
}

export class NotificationUnreadCountDto {
  @Expose()
  @ApiProperty({ minimum: 0 })
  unreadCount!: number
}
