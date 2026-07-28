import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import {
  ReviewOutcome,
  ReviewStatus,
  ReviewTriggerType,
} from '../../generated/prisma/client'

export const createReviewRequestSchema = z
  .object({
    reason: z
      .preprocess(
        (value) =>
          typeof value === 'string' && value.trim() === ''
            ? null
            : typeof value === 'string'
              ? value.trim()
              : value,
        z.string().max(200).nullable(),
      )
      .default(null),
  })
  .strict()

export type CreateReviewRequest = z.infer<typeof createReviewRequestSchema>

export class CreateReviewRequestDto {
  @ApiProperty({ nullable: true, required: false, maxLength: 200 })
  reason?: string | null
}

export class StudentReviewSummaryDto {
  @Expose()
  @ApiProperty({ enum: ReviewStatus, enumName: 'ReviewStatus' })
  status!: ReviewStatus

  @Expose()
  @ApiProperty({
    nullable: true,
    enum: ReviewOutcome,
    enumName: 'ReviewOutcome',
  })
  outcome!: ReviewOutcome | null

  @Expose()
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: string | null

  @Expose()
  @ApiProperty({ type: Boolean })
  hasNotification!: boolean

  @Expose()
  @ApiProperty({ format: 'uuid' })
  reviewCaseId!: string
}

export class CreateReviewRequestResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  caseId!: string

  @Expose()
  @ApiProperty({ format: 'uuid' })
  messageId!: string

  @Expose()
  @ApiProperty({ enum: ReviewStatus, enumName: 'ReviewStatus' })
  status!: ReviewStatus

  @Expose()
  @ApiProperty({
    enum: [ReviewTriggerType.STUDENT_REQUEST],
    enumName: 'StudentReviewTrigger',
  })
  trigger!: 'STUDENT_REQUEST'

  @Expose()
  @ApiProperty({ format: 'date-time' })
  requestedAt!: string

  @Expose()
  @ApiProperty({
    description: 'True when an existing case or request is returned.',
  })
  replayed!: boolean

  @Expose()
  @Type(() => StudentReviewSummaryDto)
  @ApiProperty({ type: StudentReviewSummaryDto })
  reviewSummary!: StudentReviewSummaryDto
}
