import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import {
  ReviewStatus,
  ReviewTriggerType,
  StudentFlagReason,
} from '../../generated/prisma/client'

export const instructorReviewQueueQuerySchema = z
  .object({
    courseId: z.uuid().optional(),
    cursor: z.uuid().optional(),
    studentFlagReason: z.enum(StudentFlagReason).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict()

export type InstructorReviewQueueQuery = z.infer<
  typeof instructorReviewQueueQuerySchema
>

export class InstructorReviewQueueQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  courseId?: string

  @ApiPropertyOptional({ format: 'uuid' })
  cursor?: string

  @ApiPropertyOptional({
    enum: StudentFlagReason,
    enumName: 'StudentFlagReason',
  })
  studentFlagReason?: StudentFlagReason

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  limit?: number
}

export class ReviewQueueCourseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty()
  code!: string

  @Expose()
  @ApiProperty()
  title!: string
}

export class ReviewQueueStudentDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ maxLength: 120 })
  displayName!: string
}

export class InstructorReviewQueueItemDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  reviewCaseId!: string

  @Expose()
  @ApiProperty({ enum: ReviewStatus, enumName: 'ReviewStatus' })
  status!: ReviewStatus

  @Expose()
  @ApiProperty({ enum: ReviewTriggerType, enumName: 'ReviewTriggerType' })
  trigger!: ReviewTriggerType

  @Expose()
  @ApiProperty({
    enum: StudentFlagReason,
    enumName: 'StudentFlagReason',
    nullable: true,
  })
  studentFlagReason!: StudentFlagReason | null

  @Expose()
  @ApiProperty({ nullable: true, maxLength: 200 })
  studentNote!: string | null

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ minimum: 0, description: 'Case age in whole seconds.' })
  age!: number

  @Expose()
  @Type(() => ReviewQueueCourseDto)
  @ApiProperty({ type: ReviewQueueCourseDto })
  course!: ReviewQueueCourseDto

  @Expose()
  @Type(() => ReviewQueueStudentDto)
  @ApiProperty({ type: ReviewQueueStudentDto })
  student!: ReviewQueueStudentDto

  @Expose()
  @ApiProperty({ description: 'Whether the case is awaiting review.' })
  pending!: boolean
}

export class InstructorReviewQueueResponseDto {
  @Expose()
  @Type(() => InstructorReviewQueueItemDto)
  @ApiProperty({ type: [InstructorReviewQueueItemDto] })
  items!: InstructorReviewQueueItemDto[]

  @Expose()
  @ApiProperty({ minimum: 0 })
  pendingCount!: number

  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  nextCursor!: string | null
}
