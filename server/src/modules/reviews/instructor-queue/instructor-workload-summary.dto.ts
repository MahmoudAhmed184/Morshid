import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import {
  ReviewTriggerType,
  StudentFlagReason,
} from '../interface/review-values'

export const instructorWorkloadSummaryQuerySchema = z
  .object({
    courseId: z.uuid().optional(),
  })
  .strict()

export type InstructorWorkloadSummaryQuery = z.infer<
  typeof instructorWorkloadSummaryQuerySchema
>

export class InstructorWorkloadSummaryQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  courseId?: string
}

export class ReasonCountDto {
  @Expose()
  @ApiProperty({ enum: StudentFlagReason, enumName: 'StudentFlagReason' })
  reason!: StudentFlagReason

  @Expose()
  @ApiProperty({ minimum: 0 })
  count!: number
}

export class TriggerCountDto {
  @Expose()
  @ApiProperty({ enum: ReviewTriggerType, enumName: 'ReviewTriggerType' })
  trigger!: ReviewTriggerType

  @Expose()
  @ApiProperty({ minimum: 0 })
  count!: number
}

export class InstructorWorkloadSummaryDto {
  @Expose()
  @ApiProperty({ minimum: 0 })
  pendingCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  inReviewCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  claimedByMeCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  totalActiveCount!: number

  @Expose()
  @ApiProperty({ format: 'date-time', nullable: true })
  oldestPendingCreatedAt!: string | null

  @Expose()
  @ApiProperty({
    minimum: 0,
    nullable: true,
    description: 'Age in seconds of the oldest pending review case.',
  })
  oldestPendingAge!: number | null

  @Expose()
  @Type(() => ReasonCountDto)
  @ApiProperty({ type: [ReasonCountDto] })
  byStudentFlagReason!: ReasonCountDto[]

  @Expose()
  @Type(() => TriggerCountDto)
  @ApiProperty({ type: [TriggerCountDto] })
  byTriggerType!: TriggerCountDto[]
}
