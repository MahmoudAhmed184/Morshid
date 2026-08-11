import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'
import { z } from 'zod'

import {
  ReviewOutcome,
  ReviewStatus,
  ReviewTriggerType,
  StudentFlagReason,
} from './review-values'

export const createReviewRequestSchema = z
  .object({
    flagReason: z.enum(StudentFlagReason),
    note: z
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
  .superRefine(({ flagReason, note }, context) => {
    if (flagReason === StudentFlagReason.OTHER && note === null) {
      context.addIssue({
        code: 'custom',
        message: 'A non-empty note is required when flagReason is OTHER',
        path: ['note'],
      })
    }
  })

export type CreateReviewRequest = z.infer<typeof createReviewRequestSchema>

export class CreateReviewRequestDto {
  @ApiProperty({ enum: StudentFlagReason, enumName: 'StudentFlagReason' })
  flagReason!: StudentFlagReason

  @ApiProperty({ nullable: true, required: false, maxLength: 200 })
  note?: string | null
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
