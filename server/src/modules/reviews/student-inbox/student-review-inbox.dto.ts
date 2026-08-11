import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import { ReviewInboxItemStatus, ReviewInboxItemType } from '../review-values'

export const studentReviewInboxListQuerySchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()

export type StudentReviewInboxListQuery = z.infer<
  typeof studentReviewInboxListQuerySchema
>

export class StudentReviewInboxListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  cursor?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  limit?: number
}

export class StudentReviewInboxItemDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ format: 'uuid' })
  reviewCaseId!: string

  @Expose()
  @ApiProperty({ format: 'uuid' })
  courseId!: string

  @Expose()
  @ApiProperty({ format: 'uuid' })
  sessionId!: string

  @Expose()
  @ApiProperty({ format: 'uuid' })
  messageId!: string

  @Expose()
  @ApiProperty({ enum: ReviewInboxItemType, enumName: 'ReviewInboxItemType' })
  type!: ReviewInboxItemType

  @Expose()
  @ApiProperty({
    enum: ReviewInboxItemStatus,
    enumName: 'ReviewInboxItemStatus',
  })
  status!: ReviewInboxItemStatus

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

export class StudentReviewInboxListResponseDto {
  @Expose()
  @Type(() => StudentReviewInboxItemDto)
  @ApiProperty({ type: [StudentReviewInboxItemDto] })
  items!: StudentReviewInboxItemDto[]

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  nextCursor!: string | null
}

export class StudentReviewInboxUnreadCountDto {
  @Expose()
  @ApiProperty({ minimum: 0 })
  unreadCount!: number
}
